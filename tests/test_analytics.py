"""Exercise the analytics daily aggregate schema and its view/click semantics."""
import sqlite3
import re
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class AnalyticsMigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = sqlite3.connect(Path(self.tmp.name) / "analytics.db")
        for migration in sorted((ROOT / "migrations").glob("*.sql")):
            self.db.executescript(migration.read_text())

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_daily_upsert_counts_views_and_distinct_visitors(self):
        upsert = """INSERT INTO analytics_daily
            (day, event_type, page_path, target_id, visitor_hash, event_count)
            VALUES (?, ?, ?, ?, ?, 1)
            ON CONFLICT(day, event_type, page_path, target_id, visitor_hash)
            DO UPDATE SET event_count = analytics_daily.event_count + 1"""
        events = [
            ("2026-11-08", "page_view", "/", "", "hash-a"),
            ("2026-11-08", "page_view", "/", "", "hash-a"),
            ("2026-11-07", "page_view", "/", "", "hash-a"),
            ("2026-11-08", "page_view", "/", "", "hash-b"),
            ("2026-11-08", "page_view", "/shop", "", "hash-a"),
            ("2026-11-08", "product_click", "/", "vlor-noir", "hash-a"),
            ("2026-11-08", "product_click", "/", "vlor-noir", "hash-a"),
            ("2026-11-08", "product_click", "/shop", "vlor-noir", "hash-b"),
        ]
        self.db.executemany(upsert, events)

        home = self.db.execute(
            """SELECT SUM(event_count), COUNT(DISTINCT visitor_hash)
               FROM analytics_daily
               WHERE event_type='page_view' AND page_path='/' AND day BETWEEN ? AND ?""",
            ("2026-11-07", "2026-11-08"),
        ).fetchone()
        self.assertEqual(home, (4, 2))

        clicks = self.db.execute(
            """SELECT SUM(event_count), COUNT(DISTINCT visitor_hash)
               FROM analytics_daily
               WHERE event_type='product_click' AND target_id='vlor-noir'"""
        ).fetchone()
        self.assertEqual(clicks, (3, 2))

    def test_analytics_event_constraints_reject_invalid_rows(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO analytics_daily(day,event_type,page_path,target_id,visitor_hash) VALUES(?,?,?,?,?)",
                ("2026-11-08", "page_view", "/", "unexpected", "hash-a"),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO analytics_daily(day,event_type,page_path,target_id,visitor_hash) VALUES(?,?,?,?,?)",
                ("2026-11-08", "product_click", "/", "", "hash-a"),
            )

    def test_additive_bootstrap_preserves_existing_data_and_restores_missing_tables(self):
        source = (ROOT / 'worker' / 'bootstrap.ts').read_text()
        self.assertIn('/analytics_daily|analytics_actions|analytics_presence/', source)
        statements = [value for value in re.findall(r'`([^`]+)`', source) if re.search(r'analytics_daily|analytics_actions|analytics_presence', value) and value.startswith('CREATE ')]
        self.assertGreaterEqual(len(statements), 6)
        self.db.execute("INSERT INTO analytics_daily(day,event_type,page_path,target_id,visitor_hash) VALUES('2026-11-08','page_view','/','','old-visitor')")
        self.db.execute('DROP TABLE analytics_actions')
        self.db.execute('DROP TABLE analytics_presence')
        for statement in statements:
            self.db.execute(statement)
        self.assertEqual(self.db.execute('SELECT visitor_hash FROM analytics_daily').fetchone()[0], 'old-visitor')
        self.db.execute("INSERT INTO analytics_actions(day,page_path,action,visitor_hash) VALUES('2026-11-08','/','checkout','old-visitor')")
        self.db.execute("INSERT INTO analytics_presence VALUES('old-visitor',100)")
        # An even older initialized database can lack the original analytics table.
        self.db.execute('DROP TABLE analytics_daily')
        for statement in statements:
            self.db.execute(statement)
        self.assertEqual(self.db.execute('SELECT count(*) FROM analytics_daily').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT count(*) FROM analytics_actions').fetchone()[0], 1)

    def test_interaction_counts_are_separate_from_legacy_analytics(self):
        self.db.execute("INSERT INTO analytics_daily(day,event_type,page_path,target_id,visitor_hash) VALUES('2026-11-08','page_view','/','','hash-a')")
        sql = """INSERT INTO analytics_actions(day,page_path,action,visitor_hash,event_count)
                 VALUES(?,?,?,?,1) ON CONFLICT(day,page_path,action,visitor_hash)
                 DO UPDATE SET event_count=analytics_actions.event_count+1"""
        self.db.executemany(sql, [('2026-11-08','/shop','add-to-cart','hash-a'), ('2026-11-08','/shop','add-to-cart','hash-a'), ('2026-11-08','/shop','add-to-cart','hash-b'), ('2026-11-08','/','add-to-cart','hash-a')])
        self.assertEqual(self.db.execute("SELECT SUM(event_count),COUNT(DISTINCT visitor_hash) FROM analytics_actions WHERE page_path='/shop'").fetchone(), (3,2))
        self.assertEqual(self.db.execute("SELECT event_count FROM analytics_daily WHERE event_type='page_view'").fetchone()[0],1)
        self.db.execute("INSERT INTO analytics_presence VALUES('hash-a',1000)")
        self.db.execute("INSERT INTO analytics_presence VALUES('hash-a',2000) ON CONFLICT(visitor_hash) DO UPDATE SET last_seen=excluded.last_seen")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM analytics_presence WHERE last_seen>=1500").fetchone()[0],1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM analytics_presence WHERE last_seen>=2500").fetchone()[0],0)


if __name__ == "__main__":
    unittest.main()
