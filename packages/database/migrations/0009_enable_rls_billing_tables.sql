-- Same treatment as migration 0003: enable RLS with no policies purely to
-- block anon/authenticated access via Supabase's PostgREST API (the app
-- connects via the service-role DATABASE_URL / Drizzle connection, which
-- bypasses RLS entirely). scheduling_rules was added after 0003 and missed
-- it; credit_transactions/organization_billing are new in this change.
ALTER TABLE "scheduling_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "credit_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organization_billing" ENABLE ROW LEVEL SECURITY;