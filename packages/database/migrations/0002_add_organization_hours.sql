CREATE TABLE "organization_hours" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "day_of_week" smallint NOT NULL,
  "start_time" time,
  "end_time" time,
  "is_closed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_hours"
  ADD CONSTRAINT "organization_hours_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id")
  REFERENCES "public"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "organization_hours" ("organization_id", "day_of_week", "start_time", "end_time", "is_closed")
SELECT id, day, '09:00'::time, '23:00'::time, false
FROM organizations
CROSS JOIN LATERAL (VALUES (0), (1), (2), (3), (4), (5), (6)) AS days(day)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION create_default_organization_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "organization_hours" ("organization_id", "day_of_week", "start_time", "end_time", "is_closed")
  VALUES
    (NEW.id, 0, '09:00'::time, '23:00'::time, false),
    (NEW.id, 1, '09:00'::time, '23:00'::time, false),
    (NEW.id, 2, '09:00'::time, '23:00'::time, false),
    (NEW.id, 3, '09:00'::time, '23:00'::time, false),
    (NEW.id, 4, '09:00'::time, '23:00'::time, false),
    (NEW.id, 5, '09:00'::time, '23:00'::time, false),
    (NEW.id, 6, '09:00'::time, '23:00'::time, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trigger_create_default_org_hours ON organizations;
--> statement-breakpoint
CREATE TRIGGER trigger_create_default_org_hours
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION create_default_organization_hours();
