-- OneFix specification v1. Apply only to a new SQLite database.
PRAGMA foreign_keys = ON;

CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE facilities (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('printer', 'air_conditioner', 'water_dispenser')),
  observed_from TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE issues (
  id TEXT PRIMARY KEY NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  symptom TEXT NOT NULL CHECK (symptom IN ('not_working', 'poor_performance', 'physical_damage', 'leak_or_noise', 'other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'acknowledged', 'in_progress', 'resolved')),
  eta_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  CHECK ((status = 'resolved' AND resolved_at IS NOT NULL) OR (status <> 'resolved' AND resolved_at IS NULL))
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY NOT NULL,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE RESTRICT,
  client_id TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  symptom TEXT NOT NULL CHECK (symptom IN ('not_working', 'poor_performance', 'physical_damage', 'leak_or_noise', 'other')),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  dedup_method TEXT NOT NULL CHECK (dedup_method IN ('none', 'ai', 'mock', 'fallback')),
  merged INTEGER NOT NULL CHECK (merged IN (0, 1))
);

CREATE TABLE participations (
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE RESTRICT,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (issue_id, client_id)
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY NOT NULL,
  report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE RESTRICT,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880)
);

CREATE INDEX issues_by_facility ON issues(facility_id, status, created_at);
CREATE INDEX reports_by_issue ON reports(issue_id, created_at);
CREATE INDEX reports_by_client_time ON reports(client_id, created_at);
