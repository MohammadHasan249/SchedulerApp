-- Indexes on columns that every hot-path query filters or joins on. Without
-- these, dashboard/schedule/clock/notification queries seq-scan as data grows.
-- All are CREATE INDEX IF NOT EXISTS so the migration is idempotent and safe
-- to re-run against an environment where someone added the index manually.

CREATE INDEX IF NOT EXISTS "shifts_branch_start_idx"
  ON "shifts" ("branch_id", "start_time");

CREATE INDEX IF NOT EXISTS "shift_assignments_employee_idx"
  ON "shift_assignments" ("employee_id");

CREATE INDEX IF NOT EXISTS "clock_events_employee_ts_idx"
  ON "clock_events" ("employee_id", "timestamp");

CREATE INDEX IF NOT EXISTS "clock_events_branch_ts_idx"
  ON "clock_events" ("branch_id", "timestamp");

CREATE INDEX IF NOT EXISTS "notifications_employee_created_idx"
  ON "notifications" ("employee_id", "created_at");

CREATE INDEX IF NOT EXISTS "time_off_employee_range_idx"
  ON "time_off_requests" ("employee_id", "start_date", "end_date");
