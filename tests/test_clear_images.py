"""The one-time image removal preserves business data and future uploads."""
import json
import re
import sqlite3
import unittest
from pathlib import Path
from test_requested_scents import database

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / 'migrations/0016_remove_existing_images.sql').read_text()
BOOTSTRAP = (ROOT / 'worker/bootstrap.ts').read_text()

class ClearImagesTests(unittest.TestCase):
    def exercise(self, run):
        db = database()
        self.addCleanup(db.close)
        old = {'name': {'en': 'Owner', 'ar': 'عطر'}, 'sizes': [{'ml': 50, 'price': 123}], 'images': ['https://example.com/old.png', '/api/images/old'], 'cutout': 'https://example.com/cutout.png', 'price': 123}
        db.execute('INSERT INTO products(id,slug,category_id,data,archived) VALUES(?,?,?,?,1)', ('p','p','woody',json.dumps(old)))
        db.execute("UPDATE inventory SET quantity=8 WHERE product_id='p'")
        db.execute("INSERT INTO images(key,content_type,data_base64,size) VALUES('old','image/png','0123456789abcdef',12)")
        run(db)
        row = json.loads(db.execute("SELECT data FROM products WHERE id='p'").fetchone()[0])
        self.assertEqual(row['images'], []); self.assertNotIn('cutout', row)
        self.assertEqual(row['price'], 123); self.assertEqual(row['sizes'], old['sizes'])
        self.assertEqual(db.execute("SELECT archived FROM products WHERE id='p'").fetchone()[0], 1)
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='p'").fetchone()[0], 8)
        self.assertEqual(db.execute('SELECT count(*) FROM images').fetchone()[0], 0)
        self.assertEqual(db.execute("SELECT count(*) FROM deleted_images WHERE key='old'").fetchone()[0], 1)
        db.execute("INSERT INTO images(key,content_type,data_base64,size) VALUES('new','image/png','0123456789abcdef',12)")
        db.execute("UPDATE products SET data=json_set(data,'$.images',json('[\"/api/images/new\"]')) WHERE id='p'")
        db.commit()
        run(db)
        self.assertEqual(db.execute('SELECT count(*) FROM images').fetchone()[0], 1)
        self.assertEqual(json.loads(db.execute("SELECT data FROM products WHERE id='p'").fetchone()[0])['images'], ['/api/images/new'])

    def test_migration_is_safe_to_repeat(self):
        self.exercise(lambda db: db.executescript(SQL))

    def test_bootstrap_fallback_is_safe_to_repeat(self):
        body = BOOTSTRAP.split('async function removeOldImages', 1)[1].split('async function initialize', 1)[0]
        statements = re.findall(r'db\.prepare\(`(.*?)`\)', body, re.S)
        self.assertEqual(len(statements), 4)
        def run(db):
            with db:
                for stmt in statements: db.execute(stmt)
        self.exercise(run)

    def test_tombstones_checked_before_edge_cache(self):
        route = (ROOT / 'worker/index.ts').read_text().split("app.get('/api/images/:key'",1)[1]
        self.assertLess(route.index('SELECT 1 FROM deleted_images'), route.index('cache?.match'))

if __name__ == '__main__': unittest.main()
