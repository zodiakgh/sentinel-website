CREATE TABLE IF NOT EXISTS voice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  created_at INTEGER NOT NULL,
  public_opt_in INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_voice_user_started ON voice_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_guild_started ON voice_sessions(guild_id, started_at DESC);
CREATE TABLE IF NOT EXISTS voice_public_consent (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, guild_id)
);
