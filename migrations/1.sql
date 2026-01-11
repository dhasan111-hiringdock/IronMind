
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_available TEXT NOT NULL DEFAULT '[]',
  training_days_per_week INTEGER NOT NULL DEFAULT 4,
  current_training_age TEXT NOT NULL DEFAULT 'BEGINNER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_training_age ON users(current_training_age);
