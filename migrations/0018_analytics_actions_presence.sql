-- Aggregated interaction counts and short-lived online estimates; no form values or IPs.
CREATE TABLE IF NOT EXISTS analytics_actions (
  day TEXT NOT NULL,
  page_path TEXT NOT NULL,
  action TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 1 CHECK(event_count >= 1),
  PRIMARY KEY(day, page_path, action, visitor_hash)
);
CREATE INDEX IF NOT EXISTS analytics_actions_period ON analytics_actions(day, page_path, action);
CREATE TABLE IF NOT EXISTS analytics_presence (
  visitor_hash TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_presence_seen ON analytics_presence(last_seen);
