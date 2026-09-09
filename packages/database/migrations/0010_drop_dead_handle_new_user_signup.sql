-- Dead code cleanup, flagged by Supabase's linter as publicly-executable
-- SECURITY DEFINER exposure (anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable). Confirmed unreachable:
-- both signup flows (apps/web/app/api/org/route.ts,
-- apps/web/app/api/auth/employee-signup/route.ts) create the auth user via
-- supabase.auth.admin.createUser() and then insert the `employees` row
-- themselves inside an explicit Drizzle transaction — the admin API bypasses
-- user-defined triggers on auth.users, so this trigger never fires in
-- practice (verified directly against a dev auth user: no error, no
-- employees row inserted, despite app_metadata.organization_id being the
-- non-uuid placeholder "__pending__" this function can't even cast).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.handle_new_user_signup();