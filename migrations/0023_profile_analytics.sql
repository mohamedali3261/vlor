-- Optional named profiles: no delivery details or order tokens are stored here.
CREATE TABLE IF NOT EXISTS analytics_profiles (profile_hash TEXT PRIMARY KEY, name TEXT NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS analytics_profile_events (profile_hash TEXT NOT NULL REFERENCES analytics_profiles(profile_hash) ON DELETE CASCADE, day TEXT NOT NULL, kind TEXT NOT NULL, page_path TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', event_count INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(profile_hash,day,kind,page_path,target));
CREATE INDEX IF NOT EXISTS analytics_profile_events_day ON analytics_profile_events(day);
-- Prevent delayed requests from recreating a profile that has been deleted.
CREATE TABLE IF NOT EXISTS analytics_profile_revocations (profile_hash TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL);
