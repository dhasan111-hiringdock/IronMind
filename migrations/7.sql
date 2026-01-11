
CREATE TABLE training_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  current_week INTEGER NOT NULL DEFAULT 1,
  current_phase TEXT NOT NULL DEFAULT 'VOLUME',
  cycle_start_date DATE NOT NULL,
  skip_count_current_week INTEGER NOT NULL DEFAULT 0,
  last_deload_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_states_user_id ON training_states(user_id);
CREATE INDEX idx_training_states_phase ON training_states(current_phase);
