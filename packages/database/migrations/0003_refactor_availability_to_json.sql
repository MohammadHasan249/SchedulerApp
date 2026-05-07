ALTER TABLE "employees"
  ADD COLUMN "availability_schedule" jsonb DEFAULT '{}' NOT NULL;
--> statement-breakpoint
DROP TABLE "availability";
