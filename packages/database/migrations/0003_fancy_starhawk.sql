DROP TABLE IF EXISTS "audit_log" CASCADE;
--> statement-breakpoint
-- Enable Row Level Security on all remaining public tables. The app connects
-- via the Postgres service-role connection (DATABASE_URL / Drizzle), which
-- bypasses RLS entirely, so no policies are added. This purely blocks
-- anon/authenticated access via Supabase's PostgREST API, which the app does
-- not use.
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "job_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shift_assignments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shift_role_requirements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "time_off_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "clock_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "permission_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pay_rates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;
