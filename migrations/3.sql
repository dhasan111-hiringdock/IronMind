
CREATE TABLE muscles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  last_trained_at TIMESTAMP,
  recovery_hours_required INTEGER NOT NULL DEFAULT 48,
  weekly_sets_completed INTEGER NOT NULL DEFAULT 0,
  weekly_sets_target INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_muscles_name ON muscles(name);
CREATE INDEX idx_muscles_last_trained ON muscles(last_trained_at);
