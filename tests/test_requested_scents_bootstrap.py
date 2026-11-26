"""Test the Worker's one-time scent backfill against real SQLite triggers."""
import json
import re
import unittest
from pathlib import Path
from test_requested_scents import NEW_PRODUCTS, database

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'worker/bootstrap.ts').read_text()
INSERT = re.search(r'const inserts = NEW_PRODUCTS\.map\(\(p\) => db\.prepare\(`(.*?)`\)', SOURCE, re.S).group(1)
MARKER = "INSERT INTO store_meta(key, value) VALUES ('requested_scents_v1', '1') ON CONFLICT(key) DO UPDATE SET value=excluded.value"


def backfill(db):
    with db:
        for p in NEW_PRODUCTS:
            db.execute(INSERT, (p['id'], p['slug'], p['category'], json.dumps(p), p['id'], p['slug'], p['name']['en'], p['name']['ar']))
        db.execute(MARKER)


class ScentBootstrapTests(unittest.TestCase):
    def test_existing_custom_products_and_archived_products_are_preserved(self):
        db = database()
        self.addCleanup(db.close)
        owner = json.dumps({'name': {'en': 'One Million', 'ar': 'وان مليون'}, 'sizes': [{'ml': 50, 'price': 37}]})
        archived = json.dumps({'name': {'en': 'Khamrah', 'ar': 'خمرة'}, 'sizes': [{'ml': 50, 'price': 45}]})
        db.execute('INSERT INTO products(id,slug,category_id,data) VALUES(?,?,?,?)', ('owner-one', 'owner-one', 'woody', owner))
        db.execute('INSERT INTO products(id,slug,category_id,data,archived) VALUES(?,?,?,?,1)', ('khamrah', 'khamrah', 'oriental', archived))
        db.execute("UPDATE inventory SET quantity=9 WHERE product_id='owner-one'")
        db.commit()
        backfill(db)
        self.assertEqual(db.execute('SELECT count(*) FROM products').fetchone()[0], 8)
        self.assertEqual(db.execute("SELECT data FROM products WHERE id='owner-one'").fetchone()[0], owner)
        self.assertEqual(db.execute("SELECT data,archived FROM products WHERE id='khamrah'").fetchone(), (archived, 1))
        self.assertIsNone(db.execute("SELECT id FROM products WHERE id='one-million'").fetchone())
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='owner-one'").fetchone()[0], 9)
        self.assertEqual(db.execute("SELECT count(*) FROM inventory WHERE product_id NOT IN ('owner-one','khamrah') AND quantity=0").fetchone()[0], 18)
        self.assertEqual(db.execute("SELECT value FROM store_meta WHERE key='requested_scents_v1'").fetchone()[0], '1')

    def test_marker_prevents_reinsertion_and_preserves_edits(self):
        db = database()
        self.addCleanup(db.close)
        backfill(db)
        db.execute("UPDATE products SET data=json_set(data,'$.price',77) WHERE id='one-million'")
        db.execute("DELETE FROM inventory WHERE product_id='invictus'")
        db.execute("DELETE FROM products WHERE id='invictus'")
        db.commit()
        backfill(db)
        self.assertIsNone(db.execute("SELECT id FROM products WHERE id='invictus'").fetchone())
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='one-million'").fetchone()[0], 77)

    def test_conflicting_slug_does_not_overwrite(self):
        db = database()
        self.addCleanup(db.close)
        custom = json.dumps({'name': {'en': 'Custom', 'ar': 'خاص'}, 'sizes': []})
        db.execute('INSERT INTO products(id,slug,category_id,data) VALUES(?,?,?,?)', ('custom', 'madawi', 'floral', custom))
        db.commit()
        backfill(db)
        self.assertEqual(db.execute("SELECT data FROM products WHERE id='custom'").fetchone()[0], custom)
        self.assertIsNone(db.execute("SELECT id FROM products WHERE id='madawi'").fetchone())


if __name__ == '__main__':
    unittest.main()
