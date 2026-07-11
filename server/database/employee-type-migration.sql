BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_type TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_type TEXT;

UPDATE users SET role = CASE lower(trim(role))
  WHEN 'ceo' THEN 'CEO'
  WHEN 'manager' THEN 'Manager'
  WHEN 'sales representative' THEN 'Sales Representative'
  WHEN 'marketing' THEN 'Marketing'
  WHEN 'accountant' THEN 'Accountant'
  WHEN 'employee' THEN 'Employee'
  ELSE role END;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_type_check;
ALTER TABLE users ADD CONSTRAINT users_employee_type_check
  CHECK (employee_type IS NULL OR employee_type IN ('lead_generator', 'caller'));

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_type_check;
ALTER TABLE employees ADD CONSTRAINT employees_employee_type_check
  CHECK (employee_type IS NULL OR employee_type IN ('lead_generator', 'caller'));

-- Preserve existing records and connect each staff user to exactly one profile.
INSERT INTO employees (user_id, name, role, employee_type, salary, phone, email, status, joining_date)
SELECT u.id, u.name, u.role, u.employee_type, 0, NULL, u.email,
       CASE WHEN lower(u.status) = 'inactive' THEN 'Inactive' ELSE 'Active' END,
       COALESCE(u.created_at::date, CURRENT_DATE)
FROM users u
WHERE u.role IN ('Manager', 'Sales Representative', 'Marketing', 'Accountant', 'Employee')
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.user_id = u.id);

UPDATE employees e
SET name = u.name,
    email = u.email,
    role = u.role,
    employee_type = u.employee_type,
    status = CASE WHEN lower(u.status) = 'inactive' THEN 'Inactive' ELSE 'Active' END
FROM users u
WHERE e.user_id = u.id;

CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_unique ON employees(user_id) WHERE user_id IS NOT NULL;

COMMIT;
