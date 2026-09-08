ALTER TABLE "permission_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "permission_profiles" CASCADE;--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN "permission_profile_id";