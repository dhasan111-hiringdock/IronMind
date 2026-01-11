
-- Add user preferences for training variations
ALTER TABLE users ADD COLUMN drop_sets_enabled BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN supersets_enabled BOOLEAN DEFAULT 0;

-- Add workout focus label to track workout intensity classification
ALTER TABLE workout_plans ADD COLUMN focus_label TEXT DEFAULT 'NORMAL';
