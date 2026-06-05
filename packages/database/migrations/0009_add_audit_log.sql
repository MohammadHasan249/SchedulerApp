CREATE TABLE IF NOT EXISTS "audit_log" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "actor_id"        uuid REFERENCES "employees"("id") ON DELETE SET NULL,
  "action"          text NOT NULL,
  "resource_type"   text NOT NULL,
  "resource_id"     text,
  "before"          jsonb,
  "after"           jsonb,
  "ip"              text,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_log_org_created_idx" ON "audit_log" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx"        ON "audit_log" ("actor_id");
