-- Add user physical stats and goal progress tracking
ALTER TABLE users ADD COLUMN height_cm INTEGER DEFAULT NULL;
ALTER TABLE users ADD COLUMN weight_kg REAL DEFAULT NULL;
ALTER TABLE users ADD COLUMN age_years INTEGER DEFAULT NULL;
ALTER TABLE users ADD COLUMN sex TEXT DEFAULT 'UNKNOWN';

CREATE TABLE goal_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  progress_date DATE NOT NULL,
  bodyweight_kg REAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_goal_progress_user_date ON goal_progress(user_id, progress_date);

