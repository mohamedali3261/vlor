"""Fixed discount migration preserves data and validates both deployment versions."""
import sqlite3
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

class FixedDiscountMigrationTests(unittest.TestCase):
    def test_upgrade_keeps_legacy_drafts_orders_and_both_rollout_contexts(self):
        db=sqlite3.connect(':memory:')
        for migration in sorted((ROOT/'migrations').glob('*.sql')):
            if migration.name=='0020_fixed_discounts.sql': break
            db.executescript(migration.read_text())
        db.execute("INSERT INTO discount_rules VALUES('old','quantity',2,20,1)")
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal,discount,coupon_code) VALUES('historic','name','phone','Cairo','address','',100,10,'OLD')")
        db.execute("INSERT INTO shipping_rates VALUES('Cairo',30,250)")
        db.commit()
        migration=(ROOT/'migrations/0020_fixed_discounts.sql').read_text()
        db.executescript(migration)
        self.assertEqual(db.execute("SELECT discount_amount,legacy_percent,enabled FROM discount_amount_rules WHERE id='old'").fetchone(),(None,20,0))
        self.assertEqual(db.execute("SELECT subtotal,discount,coupon_code FROM orders WHERE id='historic'").fetchone(),(100,10,'OLD'))
        # During deployment the earlier worker may finish an order at its original percentage.
        db.execute("INSERT INTO checkout_discount_context VALUES('old-worker',2)")
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal,shipping,discount,tracking_hash) VALUES('old-worker','n','p','Cairo','a','',300,30,60,'old-hash')")
        db.execute("INSERT INTO discount_amount_rules VALUES('new','quantity',2,50,NULL,1)")
        db.execute("INSERT INTO checkout_amount_context VALUES('new-worker',2)")
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal,shipping,discount,tracking_hash) VALUES('new-worker','n','p','Cairo','a','',300,0,50,'new-hash')")
        db.execute("INSERT INTO checkout_amount_context VALUES('bad',2)")
        with self.assertRaisesRegex(sqlite3.IntegrityError,'discount_changed'):
            db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal,shipping,discount,tracking_hash) VALUES('bad','n','p','Cairo','a','',300,0,49,'bad-hash')")
        db.execute("DELETE FROM discount_amount_rules WHERE id='old'")
        db.commit(); db.executescript(migration)
        self.assertEqual(db.execute("SELECT count(*) FROM discount_amount_rules WHERE id='old'").fetchone()[0],0)
        self.assertEqual(db.execute("SELECT discount_amount FROM discount_amount_rules WHERE id='new'").fetchone()[0],50)
        db.close()
