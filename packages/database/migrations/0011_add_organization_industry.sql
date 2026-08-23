DO $$ BEGIN
  CREATE TYPE "organization_industry" AS ENUM ('restaurant', 'retail', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "industry" "organization_industry" NOT NULL DEFAULT 'other';
