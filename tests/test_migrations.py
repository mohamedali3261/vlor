"""Verify one-time data migrations preserve owner-defined product colours."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PrimaryGoldMigrationTests(unittest.TestCase):
    def test_updates_only_the_previous_builtin_accent(self):
        with tempfile.TemporaryDirectory() as directory:
            db = sqlite3.connect(Path(directory) / "migration.db")
            try:
                migrations = sorted((ROOT / "migrations").glob("*.sql"))
                for migration in migrations:
                    if migration.name == "0012_primary_gold.sql":
                        break
                    db.executescript(migration.read_text())

                products = [
                    ("default", "default", "woody", json.dumps({"accent": "#B89A62"})),
                    ("custom", "custom", "woody", json.dumps({"accent": "#C9B5F7"})),
                ]
                db.executemany("INSERT INTO products(id,slug,category_id,data) VALUES(?,?,?,?)", products)
                db.executescript((ROOT / "migrations" / "0012_primary_gold.sql").read_text())

                result = dict(db.execute("SELECT id,json_extract(data,'$.accent') FROM products"))
                self.assertEqual(result["default"], "#D4A035")
                self.assertEqual(result["custom"], "#C9B5F7")
            finally:
                db.close()


class OrderContactsMigrationTests(unittest.TestCase):
    def test_existing_order_survives_and_optional_phone_can_be_added(self):
        db = sqlite3.connect(":memory:")
        db.execute("PRAGMA foreign_keys=ON")
        for migration in sorted((ROOT / "migrations").glob("*.sql")):
            if migration.name == "0017_order_additional_phone.sql":
                break
            db.executescript(migration.read_text())
        db.execute("INSERT INTO orders(id,customer_name,phone,city,address,note,subtotal) VALUES(?,?,?,?,?,?,?)", ("old", "Old Customer", "01012345678", "Cairo", "Old address", "", 42))
        db.executescript((ROOT / "migrations" / "0017_order_additional_phone.sql").read_text())
        db.executescript((ROOT / "migrations" / "0017_order_additional_phone.sql").read_text())
        self.assertEqual(db.execute("SELECT phone,subtotal FROM orders WHERE id='old'").fetchone(), ("01012345678", 42))
        self.assertIsNone(db.execute("SELECT additional_phone FROM order_contacts WHERE order_id='old'").fetchone())
        db.execute("INSERT INTO order_contacts VALUES(?,?)", ("old", "01112345678"))
        self.assertEqual(db.execute("SELECT additional_phone FROM order_contacts WHERE order_id='old'").fetchone()[0], "01112345678")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO order_contacts VALUES('missing', '01112345678')")
        db.close()


if __name__ == "__main__":
    unittest.main()
