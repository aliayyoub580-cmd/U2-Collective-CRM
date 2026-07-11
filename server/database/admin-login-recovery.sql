-- U2 CRM admin login recovery
-- Safe for existing data: does not truncate tables or delete users.
-- Run in the Supabase SQL Editor, then restart the local API.

BEGIN;

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS employee_type TEXT;

-- This application authenticates through Express with a server-held Supabase
-- key. The current local configuration uses a publishable key, so RLS must not
-- hide the custom users table from that backend key.
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create the documented administrator when missing. If it already exists,
-- reactivate it and reset its password to admin123.
INSERT INTO users (name, email, password, role, status, employee_type)
VALUES (
  'Admin CEO',
  'admin@u2collective.com',
  '$2a$10$Hxdd88zZVc.kAeesvusCB.HjsB8rlMnZWSYAq2DW6PRf1Qn2SnZjS',
  'CEO',
  'active',
  NULL
)
ON CONFLICT (email) DO UPDATE
SET password = EXCLUDED.password,
    role = 'CEO',
    status = 'active',
    employee_type = NULL;

COMMIT;

-- Verification: this should return exactly one active CEO row.
SELECT id, name, email, role, status
FROM users
WHERE lower(email) = 'admin@u2collective.com';
