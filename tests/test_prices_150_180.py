"""Verify the one-time price-only update on isolated SQLite databases."""
import json
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL = (ROOT / 'migrations/0026_prices_150_180.sql').read_text()
SOURCE = (ROOT / 'worker/bootstrap.ts').read_text()
BLOCK = re.search(r'const CATALOG_PRICE_150_180_STATEMENTS = \[(.*?)\];', SOURCE, re.S).group(1)
BOOTSTRAP = re.findall(r'`(.*?)`', BLOCK, re.S)
MARK = 'catalog_prices_150_180_v1'
PREVIOUS = 'catalog_30_50_149_179_stock5_v1'


def database():
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    for path in sorted((ROOT / 'migrations').glob('*.sql')):
        if path.name == '0026_prices_150_180.sql':
            break
        db.executescript(path.read_text())
    return db


def add(db, pid, data, archived=0):
    db.execute('INSERT INTO products(id,slug,category_id,data,archived) VALUES(?,?,?,?,?)',
               (pid, pid, 'woody', json.dumps(data, ensure_ascii=False), archived))


class PriceRolloutTests(unittest.TestCase):
    def test_price_changes_only_and_preserves_image_stock_and_past_orders(self):
        db = database()
        self.addCleanup(db.close)
        db.execute("INSERT OR IGNORE INTO store_meta(key,value) VALUES(?, '1')", (PREVIOUS,))
        item = {'price': 149, 'compareAt': 179, 'sizes': [{'ml': 30, 'price': 149, 'extra': 'keep'}, {'ml': 50, 'price': 179}, {'ml': 80, 'price': 250}], 'images': ['https://example.com/a.png'], 'name': {'ar': 'اسم'}, 'custom': {'keep': True}}
        add(db, 'price-test', item)
        custom = {'price': 220, 'sizes': [{'ml': 30, 'price': 250}, {'ml': 50, 'price': 179}], 'images': [], 'note': 'keep'}
        add(db, 'custom-test', custom)
        unchanged = {'price': 250, 'sizes': [{'ml': 30, 'price': 250}], 'images': []}
        add(db, 'unchanged-test', unchanged)
        add(db, 'archived-test', item, 1)
        db.execute("UPDATE inventory SET quantity=7 WHERE product_id='price-test'")
        # Stale image-size entries must also survive the price-only change.
        db.executemany('INSERT INTO image_stock VALUES(?,?,?,?)', [('price-test','https://example.com/a.png',30,0), ('price-test','https://example.com/legacy.png',75,9)])
        db.execute("INSERT INTO shipping_rates VALUES('price-city',60,500)")
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal) VALUES('price-order','Name','010','price-city','Address','',149)")
        db.execute("INSERT INTO order_items VALUES('price-item','price-order','price-test','Name',30,149,1)")
        inventory = db.execute('SELECT * FROM inventory ORDER BY product_id,size').fetchall()
        image_stock = db.execute('SELECT * FROM image_stock ORDER BY product_id,image_url,size').fetchall()
        before_other = dict(db.execute("SELECT id,data FROM products WHERE id NOT IN ('price-test','custom-test')"))
        db.commit()
        db.executescript(SQL)
        updated = json.loads(db.execute("SELECT data FROM products WHERE id='price-test'").fetchone()[0])
        expected = dict(item, price=150, sizes=[{'ml':30,'price':150,'extra':'keep'}, {'ml':50,'price':180}, {'ml':80,'price':250}])
        self.assertEqual(updated, expected)
        self.assertEqual(json.loads(db.execute("SELECT data FROM products WHERE id='custom-test'").fetchone()[0]), dict(custom, sizes=[{'ml':30,'price':250}, {'ml':50,'price':180}]))
        self.assertEqual(dict(db.execute("SELECT id,data FROM products WHERE id NOT IN ('price-test','custom-test')")), before_other)
        self.assertEqual(db.execute('SELECT * FROM inventory ORDER BY product_id,size').fetchall(), inventory)
        self.assertEqual(db.execute('SELECT * FROM image_stock ORDER BY product_id,image_url,size').fetchall(), image_stock)
        self.assertEqual(db.execute("SELECT amount,free_threshold FROM shipping_rates WHERE city='price-city'").fetchone(), (60,500))
        self.assertEqual(db.execute("SELECT unit_price FROM order_items WHERE id='price-item'").fetchone(), (149,))
        self.assertEqual(db.execute('SELECT value FROM store_meta WHERE key=?', (MARK,)).fetchone(), ('1',))
        self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='price_150_180_image_stock_backup'").fetchone())
        # Never touch owner edits or new products when this rollout is executed again.
        db.execute("UPDATE products SET data=json_set(data,'$.price',149,'$.sizes[0].price',149) WHERE id='price-test'")
        db.execute("UPDATE inventory SET quantity=1 WHERE product_id='price-test' AND size=30")
        add(db, 'new-owner-product', item)
        db.commit()
        db.executescript(SQL)
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='price-test'").fetchone()[0], 149)
        self.assertEqual(json.loads(db.execute("SELECT data FROM products WHERE id='new-owner-product'").fetchone()[0]), item)
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='price-test' AND size=30").fetchone()[0], 1)

    def test_migration_before_seed_and_bootstrap_equivalence(self):
        db = database()
        self.addCleanup(db.close)
        db.execute('DELETE FROM store_meta WHERE key IN (?,?)', (MARK, PREVIOUS))
        db.commit()
        db.executescript(SQL)
        self.assertIsNone(db.execute('SELECT value FROM store_meta WHERE key=?', (MARK,)).fetchone())
        db.execute("INSERT INTO store_meta VALUES(?, '1')", (PREVIOUS,))
        add(db, 'seed-price', {'price': 149, 'sizes':[{'ml':30,'price':149},{'ml':50,'price':179}], 'images':[]})
        db.commit()
        with db:
            for statement in BOOTSTRAP:
                db.execute(statement)
        data = json.loads(db.execute("SELECT data FROM products WHERE id='seed-price'").fetchone()[0])
        self.assertEqual((data['price'], [s['price'] for s in data['sizes']]), (150,[150,180]))
        db.execute("UPDATE products SET data=json_set(data,'$.price',149) WHERE id='seed-price'")
        db.commit()
        with db:
            for statement in BOOTSTRAP:
                db.execute(statement)
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='seed-price'").fetchone()[0],149)
        migration_statements = [part.strip() for part in re.sub(r'^--.*$', '', SQL, flags=re.M).split(';') if part.strip()]
        self.assertEqual(migration_statements, BOOTSTRAP)

    def test_invalid_json_aborts_without_partial_update(self):
        db = database()
        self.addCleanup(db.close)
        db.execute("INSERT OR IGNORE INTO store_meta(key,value) VALUES(?, '1')", (PREVIOUS,))
        add(db, 'valid-price', {'price':149, 'sizes':[{'ml':30,'price':149}], 'images':[]})
        for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='products'").fetchall():
            db.execute('DROP TRIGGER "' + name + '"')
        db.execute("INSERT INTO products(id,slug,category_id,data) VALUES('bad-price','bad-price','woody','not json')")
        db.commit()
        db.executescript(SQL)
        self.assertIsNone(db.execute('SELECT value FROM store_meta WHERE key=?', (MARK,)).fetchone())
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='valid-price'").fetchone()[0],149)
