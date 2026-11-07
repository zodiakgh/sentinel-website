PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  spdx_id TEXT UNIQUE,
  osi_approved INTEGER NOT NULL DEFAULT 0 CHECK (osi_approved IN (0, 1)),
  official_url TEXT,
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS software (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  website_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  repository_host TEXT,
  repository_owner TEXT,
  repository_name TEXT,
  pricing_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (pricing_status IN ('free', 'freemium', 'paid', 'unverified')),
  free_to_use_verified INTEGER NOT NULL DEFAULT 0
    CHECK (free_to_use_verified IN (0, 1)),
  license_id TEXT REFERENCES licenses(id),
  license_verified INTEGER NOT NULL DEFAULT 0
    CHECK (license_verified IN (0, 1)),
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected', 'needs_review')),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  last_release_at TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (verification_status != 'approved' OR
    (free_to_use_verified = 1 AND license_verified = 1 AND license_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_fr TEXT,
  description_en TEXT,
  description_fr TEXT
);

CREATE TABLE IF NOT EXISTS software_categories (
  software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (software_id, category_id)
);

CREATE TABLE IF NOT EXISTS software_platforms (
  software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'windows', 'macos', 'linux', 'android', 'ios', 'bsd', 'self_hosted')),
  PRIMARY KEY (software_id, platform)
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  checked_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS verification_logs (
  id TEXT PRIMARY KEY,
  software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES users(id),
  check_type TEXT NOT NULL,
  result TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  submitted_by TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, software_id)
);

CREATE INDEX IF NOT EXISTS idx_software_status_name
  ON software (verification_status, name);
CREATE INDEX IF NOT EXISTS idx_software_slug
  ON software (slug);
CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON submissions (status, created_at);
CREATE INDEX IF NOT EXISTS idx_sources_software
  ON sources (software_id);
