
CREATE TABLE workout_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  goal_id INTEGER,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  estimated_duration_minutes INTEGER NOT NULL,
  exercises TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workout_plans_user_id ON workout_plans(user_id);
CREATE INDEX idx_workout_plans_scheduled_date ON workout_plans(scheduled_date);
CREATE INDEX idx_workout_plans_status ON workout_plans(status);
