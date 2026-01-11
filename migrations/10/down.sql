DROP INDEX idx_devices_token;
DROP TABLE devices;
ALTER TABLE users DROP COLUMN password_iterations;
ALTER TABLE users DROP COLUMN password_salt;
ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users DROP COLUMN email;
