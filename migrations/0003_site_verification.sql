PRAGMA foreign_keys = ON;
ALTER TABLE sites ADD COLUMN verification_token TEXT;
ALTER TABLE sites ADD COLUMN verified_at TEXT;
CREATE INDEX IF NOT EXISTS idx_site_events_site_visitor ON site_events(site_id, visitor_hash);
