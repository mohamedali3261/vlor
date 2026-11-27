import sqlite3, unittest
from pathlib import Path
class ProfileAnalyticsMigration(unittest.TestCase):
    def test_idempotent_schema_and_cascade(self):
        db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON')
        migration=Path('migrations/0023_profile_analytics.sql').read_text();db.executescript(migration);db.executescript(migration)
        db.execute("INSERT INTO analytics_profiles VALUES('id','name',1)")
        db.execute("INSERT INTO analytics_profile_events VALUES('id','2026-01-01','page_view','/shop','',1)")
        db.execute("INSERT INTO analytics_profile_revocations VALUES('id',1)")
        db.execute("DELETE FROM analytics_profiles WHERE profile_hash='id'")
        self.assertEqual(db.execute('SELECT count(*) FROM analytics_profile_events').fetchone()[0],0)
        self.assertEqual(db.execute('SELECT count(*) FROM analytics_profile_revocations').fetchone()[0],1)
