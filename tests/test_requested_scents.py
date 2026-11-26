"""Exercise the scent migration on existing and freshly initialized D1 schemas."""
import json
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEW_PRODUCTS = json.loads((ROOT / "worker/newProducts.json").read_text())
MIGRATION = (ROOT / "migrations/0015_requested_scents.sql").read_text()


def database():
    db = sqlite3.connect(":memory:")
    for path in sorted((ROOT / "migrations").glob("*.sql")):
        if path.name == "0015_requested_scents.sql":
            break
        db.executescript(path.read_text())
    return db


class RequestedScentsTests(unittest.TestCase):
    def test_existing_catalogue_keeps_owner_data_and_adds_zero_stock(self):
        db = database()
        self.addCleanup(db.close)
        owner_data = json.dumps({"name": {"en": "Owner perfume", "ar": "عطر صاحب المتجر"}, "sizes": [{"ml": 50, "price": 42}]})
        db.execute("INSERT INTO products(id,slug,category_id,data) VALUES(?,?,?,?)", ("owner", "owner", "woody", owner_data))
        db.execute("UPDATE inventory SET quantity=9 WHERE product_id='owner' AND size=50")
        db.executescript(MIGRATION)
        saved = {row[0]: json.loads(row[1]) for row in db.execute("SELECT id,data FROM products WHERE id != 'owner'")}
        self.assertEqual(saved, {p["id"]: p for p in NEW_PRODUCTS})
        self.assertEqual(db.execute("SELECT data FROM products WHERE id='owner'").fetchone()[0], owner_data)
        self.assertEqual(db.execute("SELECT quantity FROM inventory WHERE product_id='owner' AND size=50").fetchone()[0], 9)
        self.assertEqual(db.execute("SELECT count(*) FROM inventory WHERE product_id != 'owner' AND quantity=0").fetchone()[0], 24)
        db.execute("UPDATE products SET data=json_set(data,'$.price',77) WHERE id='one-million'")
        db.executescript(MIGRATION)
        self.assertEqual(db.execute("SELECT json_extract(data,'$.price') FROM products WHERE id='one-million'").fetchone()[0], 77)
        self.assertEqual(db.execute("SELECT count(*) FROM products").fetchone()[0], 9)

    def test_fresh_migration_leaves_catalogue_empty_for_bootstrap(self):
        db = database()
        self.addCleanup(db.close)
        db.executescript(MIGRATION)
        self.assertEqual(db.execute("SELECT count(*) FROM products").fetchone()[0], 0)
        # Bootstrap seeds the original catalogue and these same profiles together.
        for p in NEW_PRODUCTS:
            db.execute("INSERT INTO products(id,slug,category_id,data) VALUES(?,?,?,?)", (p['id'], p['slug'], p['category'], json.dumps(p)))
        self.assertEqual(db.execute("SELECT count(*) FROM inventory WHERE quantity=0").fetchone()[0], 24)

    def test_existing_name_is_not_duplicated_or_overwritten(self):
        db = database()
        self.addCleanup(db.close)
        owner_data = json.dumps({"name": {"en": "ONE MILLION", "ar": "وان مليون"}, "sizes": [{"ml": 100, "price": 99}]})
        db.execute("INSERT INTO products(id,slug,category_id,data) VALUES(?,?,?,?)", ("custom-one", "custom-one", "woody", owner_data))
        db.executescript(MIGRATION)
        self.assertEqual(db.execute("SELECT count(*) FROM products").fetchone()[0], 8)
        self.assertIsNone(db.execute("SELECT id FROM products WHERE id='one-million'").fetchone())
        self.assertEqual(db.execute("SELECT data FROM products WHERE id='custom-one'").fetchone()[0], owner_data)

    def test_initialized_empty_catalogue_still_gets_new_products(self):
        db = database()
        self.addCleanup(db.close)
        db.execute("INSERT INTO store_meta(key,value) VALUES('seed_v2','1')")
        db.executescript(MIGRATION)
        self.assertEqual(db.execute("SELECT count(*) FROM products").fetchone()[0], 8)

    def test_profiles_have_no_false_ratings_and_use_one_pound(self):
        self.assertEqual(len(NEW_PRODUCTS), 8)
        for product in NEW_PRODUCTS:
            with self.subTest(product=product["id"]):
                self.assertEqual(product["price"], 1)
                self.assertTrue(all(size["price"] == 1 for size in product["sizes"]))
                self.assertEqual((product["rating"], product["reviews"]), (0, 0))
                self.assertNotIn("edition", product)
                self.assertNotIn("brand", product)
                self.assertTrue(product["description"]["ar"] and product["description"]["en"])
        white_oud = next(p for p in NEW_PRODUCTS if p["id"] == "white-oud")
        self.assertTrue(all(not group for group in white_oud["notes"].values()))
        self.assertIn("تختلف", white_oud["description"]["ar"])


if __name__ == "__main__":
    unittest.main()
