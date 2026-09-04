-- Additive migration: existing facility data is preserved.
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('academic','scholarship','office')),
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  answer TEXT,
  answered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS question_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id),
  request_id TEXT UNIQUE NOT NULL,
  payload_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  dedup_method TEXT NOT NULL CHECK (dedup_method IN ('none','ai','mock','fallback')),
  merged INTEGER NOT NULL CHECK (merged IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS question_participations (
  question_id TEXT NOT NULL REFERENCES questions(id),
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (question_id, client_id)
);
CREATE INDEX IF NOT EXISTS questions_scope ON questions(department,period,created_at);
CREATE INDEX IF NOT EXISTS question_submissions_group ON question_submissions(question_id,created_at);

CREATE TABLE IF NOT EXISTS question_submission_answers (
  submission_id TEXT PRIMARY KEY NOT NULL REFERENCES question_submissions(id),
  answer TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('answered','needs_clarification')),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
