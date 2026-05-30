-- Clean up duplicate shift assignments before adding the unique constraint.
-- Keeps the oldest row per (shift_id, employee_id) by id ordering.
DELETE FROM "shift_assignments" a
USING "shift_assignments" b
WHERE a.id > b.id
  AND a.shift_id = b.shift_id
  AND a.employee_id = b.employee_id;

ALTER TABLE "shift_assignments"
  ADD CONSTRAINT "shift_assignments_shift_emp_unique" UNIQUE ("shift_id", "employee_id");

-- Clean up duplicate role requirements.
DELETE FROM "shift_role_requirements" a
USING "shift_role_requirements" b
WHERE a.id > b.id
  AND a.shift_id = b.shift_id
  AND a.job_role_id = b.job_role_id;

ALTER TABLE "shift_role_requirements"
  ADD CONSTRAINT "shift_role_requirements_shift_role_unique" UNIQUE ("shift_id", "job_role_id");

-- Add (organization_id, email) uniqueness on employees.
-- If duplicates exist in prod this will fail; admin should resolve manually.
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_org_email_unique" UNIQUE ("organization_id", "email");
