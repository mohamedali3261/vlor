import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class HiddenOrderMigrationTests(unittest.TestCase):
    def test_additive_idempotent_and_order_remains(self):
        db=sqlite3.connect(':memory:')
        for migration in sorted((ROOT/'migrations').glob('*.sql')):
            if migration.name=='0021_hide_studio_orders.sql':break
            db.executescript(migration.read_text())
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal) VALUES('old','name','phone','Cairo','address','',100)")
        sql=(ROOT/'migrations/0021_hide_studio_orders.sql').read_text()
        db.executescript(sql);db.execute("INSERT INTO hidden_studio_orders(order_id) VALUES('old')");db.commit();db.executescript(sql)
        self.assertEqual(db.execute("SELECT subtotal FROM orders WHERE id='old'").fetchone()[0],100)
        self.assertEqual(db.execute("SELECT count(*) FROM hidden_studio_orders WHERE order_id='old'").fetchone()[0],1)
        db.close()
