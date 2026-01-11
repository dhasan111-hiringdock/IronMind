
CREATE TABLE workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_plan_id INTEGER NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  completed_exercises TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  overall_difficulty INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workout_sessions_plan_id ON workout_sessions(workout_plan_id);
CREATE INDEX idx_workout_sessions_started ON workout_sessions(started_at);
CREATE INDEX idx_workout_sessions_completed ON workout_sessions(completed_at);
