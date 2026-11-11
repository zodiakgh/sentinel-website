PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','member','viewer')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email_created ON auth_codes(email, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  interval_seconds INTEGER NOT NULL DEFAULT 300,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  expected_status_min INTEGER NOT NULL DEFAULT 200,
  expected_status_max INTEGER NOT NULL DEFAULT 399,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_checked_at INTEGER,
  next_check_at INTEGER NOT NULL,
  last_status TEXT NOT NULL DEFAULT 'pending',
  last_status_code INTEGER,
  last_latency_ms INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitors_due ON monitors(enabled, next_check_at);
CREATE INDEX IF NOT EXISTS idx_monitors_org ON monitors(organization_id);

CREATE TABLE IF NOT EXISTS monitor_checks (
  id TEXT PRIMARY KEY,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('up','down')),
  status_code INTEGER,
  latency_ms INTEGER,
  error TEXT,
  checked_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checks_monitor_time ON monitor_checks(monitor_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS status_pages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status_pages_org ON status_pages(organization_id);

CREATE TABLE IF NOT EXISTS status_page_monitors (
  status_page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  PRIMARY KEY (status_page_id, monitor_id)
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monitor_id TEXT REFERENCES monitors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  impact TEXT NOT NULL DEFAULT 'minor' CHECK (impact IN ('none','minor','major','critical')),
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_incidents_org_time ON incidents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents(organization_id, resolved_at);

CREATE TABLE IF NOT EXISTS incident_updates (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id, created_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  status_page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  token_hash TEXT NOT NULL,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(status_page_id, email)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_resolved ON incidents(resolved_at);
CREATE INDEX IF NOT EXISTS idx_auth_rate_window ON auth_rate_limits(window_started_at);