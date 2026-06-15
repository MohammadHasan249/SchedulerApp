DO $$ BEGIN
  CREATE TYPE "pay_type" AS ENUM ('hourly', 'salary');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "permission_profiles" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name"            text NOT NULL,
  "permissions"     jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "permission_profiles_org_name_unique" UNIQUE ("organization_id", "name")
);

CREATE TABLE IF NOT EXISTS "pay_rates" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id"            uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "pay_type"               "pay_type" NOT NULL,
  "amount_cents"           integer NOT NULL,
  "currency"               text NOT NULL DEFAULT 'CAD',
  "effective_date"         date NOT NULL,
  "note"                   text,
  "created_at"             timestamptz NOT NULL DEFAULT now(),
  "created_by_employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "pay_rates_employee_effective_idx" ON "pay_rates" ("employee_id", "effective_date");

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "permission_profile_id" uuid REFERENCES "permission_profiles"("id") ON DELETE SET NULL;
