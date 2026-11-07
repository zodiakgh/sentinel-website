PRAGMA foreign_keys = ON;
ALTER TABLE users ADD COLUMN password_hash TEXT;
CREATE TABLE IF NOT EXISTS auth_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits(key_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,window_started_at INTEGER NOT NULL);