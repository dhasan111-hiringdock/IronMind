-- Revert goal progress tracking and user physical stats
DROP TABLE goal_progress;
ALTER TABLE users DROP COLUMN sex;
ALTER TABLE users DROP COLUMN age_years;
ALTER TABLE users DROP COLUMN weight_kg;
ALTER TABLE users DROP COLUMN height_cm;

