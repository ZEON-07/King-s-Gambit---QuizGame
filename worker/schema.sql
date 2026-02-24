-- Teams participating in the quiz
CREATE TABLE IF NOT EXISTS teams (
  id            TEXT PRIMARY KEY,          
  name          TEXT NOT NULL,
  passkey       TEXT NOT NULL UNIQUE,       
  session_token TEXT,                      
  score         INTEGER NOT NULL DEFAULT 0
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id             TEXT PRIMARY KEY,     
  question_text  TEXT NOT NULL,
  option_a       TEXT NOT NULL,
  option_b       TEXT NOT NULL,
  option_c       TEXT NOT NULL,
  option_d       TEXT NOT NULL,
  correct_answer INTEGER NOT NULL      
);

-- Answer submissions (one per team per question)
CREATE TABLE IF NOT EXISTS submissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         TEXT NOT NULL,
  question_id     TEXT NOT NULL,
  selected_answer INTEGER NOT NULL,     
  is_correct      INTEGER NOT NULL,     
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, question_id),         
  FOREIGN KEY (team_id)     REFERENCES teams(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Admin-controlled global settings
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default: leaderboard disabled
INSERT OR IGNORE INTO settings (key, value) VALUES ('leaderboard_enabled', 'false');

CREATE TABLE IF NOT EXISTS violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT REFERENCES teams(id),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
