
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  primary_muscles TEXT NOT NULL,
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  equipment_required TEXT NOT NULL,
  exercise_type TEXT NOT NULL,
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exercises_type ON exercises(exercise_type);
CREATE INDEX idx_exercises_equipment ON exercises(equipment_required);
