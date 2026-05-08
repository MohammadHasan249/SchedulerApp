-- Add hours_schedule jsonb column with all-days-open default
ALTER TABLE "organizations"
  ADD COLUMN "hours_schedule" jsonb DEFAULT '{"0":{"startTime":"09:00","endTime":"23:00"},"1":{"startTime":"09:00","endTime":"23:00"},"2":{"startTime":"09:00","endTime":"23:00"},"3":{"startTime":"09:00","endTime":"23:00"},"4":{"startTime":"09:00","endTime":"23:00"},"5":{"startTime":"09:00","endTime":"23:00"},"6":{"startTime":"09:00","endTime":"23:00"}}' NOT NULL;
--> statement-breakpoint

-- Migrate existing data (open days only; closed days are omitted = closed in new format)
UPDATE "organizations" o
SET "hours_schedule" = COALESCE(
  (
    SELECT jsonb_object_agg(
      oh.day_of_week::text,
      jsonb_build_object(
        'startTime', to_char(oh.start_time, 'HH24:MI'),
        'endTime',   to_char(oh.end_time,   'HH24:MI')
      )
    )
    FROM "organization_hours" oh
    WHERE oh.organization_id = o.id
      AND NOT oh.is_closed
      AND oh.start_time IS NOT NULL
      AND oh.end_time   IS NOT NULL
  ),
  '{"0":{"startTime":"09:00","endTime":"23:00"},"1":{"startTime":"09:00","endTime":"23:00"},"2":{"startTime":"09:00","endTime":"23:00"},"3":{"startTime":"09:00","endTime":"23:00"},"4":{"startTime":"09:00","endTime":"23:00"},"5":{"startTime":"09:00","endTime":"23:00"},"6":{"startTime":"09:00","endTime":"23:00"}}'::jsonb
);
--> statement-breakpoint

-- Drop the trigger + function that inserted rows into organization_hours on org creation
DROP TRIGGER IF EXISTS trigger_create_default_org_hours ON "organizations";
--> statement-breakpoint
DROP FUNCTION IF EXISTS create_default_organization_hours();
--> statement-breakpoint

-- Drop the now-redundant table
DROP TABLE "organization_hours";
