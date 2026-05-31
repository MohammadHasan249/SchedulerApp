# SchedulerApp — Claude Code Context

## What this is
Multi-tenant employee scheduling SaaS (Homebase/Deputy-style). Repo: `MohammadHasan249/SchedulerApp`. Collaborator: Krayyan.

## Monorepo Structure
```
apps/web        → Next.js 15 App Router (deployed on Vercel)
apps/mobile     → Expo 54 React Native (Expo Go for testing)
packages/
  api-client    → Shared fetch client used by mobile app
  database      → Drizzle ORM schema + migrations (PostgreSQL)
  types         → Shared TypeScript types
```

## Key Commands
```bash
# Dev
npm run dev                          # runs web + all packages via turbo
cd apps/mobile && npx expo start --tunnel --clear   # mobile dev server

# Database
cd packages/database && npx drizzle-kit generate    # generate migration from schema diff
cd packages/database && npx drizzle-kit migrate     # apply migrations to DB

# Type check (run before committing)
npx turbo run type-check

# Tests
cd apps/web && npx vitest run
```

## Supabase Project
Credentials live in `apps/web/.env.local` (web) and `apps/mobile/.env.local` (mobile), not in source. Required env vars:

**Web (`apps/web/.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, admin auth ops)
- `DATABASE_URL` (Drizzle connection — reset DB password at Supabase → Settings → Database)
- `NEXT_PUBLIC_APP_URL`

**Mobile (`apps/mobile/.env.local`):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

Ask a maintainer for current values.

## Deployment
Deploy with `vercel --cwd apps/web` from the repo root after `vercel link`. Required env vars on Vercel: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`.

Note: if the production Vercel has Deployment Protection enabled, mobile API calls will return 401. Either deploy to a separate non-protected project for mobile testing or disable protection in Vercel project settings.

## Mobile App
- Env file: `apps/mobile/.env.local`
- `EXPO_PUBLIC_API_URL` must point to a non-protected deployment
- Expo tunnel URL (current session): `exp://hn1yxns-anonymous-8081.exp.direct`
- Test login: ask a maintainer (don't commit credentials to this file)

## Auth Architecture
- **Web:** Supabase cookie-based auth via SSR (`@supabase/ssr`)
- **Mobile:** Supabase Bearer token stored in SecureStore
  - SecureStore key format: `startsWith("sb-") && endsWith("-auth-token")` — critical, must match exactly

## Database Schema (packages/database/src/schema/)
Key tables: `organizations`, `branches`, `employees`, `shifts`, `shift_assignments`, `shift_role_requirements`, `time_off_requests`, `shift_swap_requests`, `availability`, `clock_events`, `notifications`, `job_roles`

Important constraints added in migration 0007:
- `shift_assignments`: UNIQUE(shift_id, employee_id)
- `shift_role_requirements`: UNIQUE(shift_id, job_role_id)
- `employees`: UNIQUE(organization_id, email)

## API Routes (apps/web/app/api/)
`auth`, `availability`, `branches`, `clock`, `dashboard`, `employees`, `job-roles`, `notifications`, `org`, `settings`, `shift-swaps`, `shifts`, `time-off`, `ai`

## Known Gotchas
1. **Vercel Deployment Protection** — any `fetch()` to Moh's Vercel from mobile returns 401. Solution: deploy to own Vercel or ask Moh to disable protection.
2. **SecureStore key mismatch** — if auth tokens don't persist on mobile, check the key format in `apps/mobile/lib/supabase.ts`
3. **drizzle-kit generate before migrate** — always generate first, review the SQL, then apply. Never skip the review step.
4. **apiFetch 204 handling** — `packages/api-client/src/client.ts` must handle empty body; fixed in PR #5.
5. **Mobile API client** — when adding a new web API route, always add the matching function in `packages/api-client/src/`
6. **Timezone** — `ShiftCreateDialog` uses local `getDay()`, auto-assign uses `getUTCDay()`. Be consistent — prefer UTC.

## PRs (on MohammadHasan249/SchedulerApp)
- **PR #4:** shift disappear fix (awaiting review)
- **PR #5:** 21 bug fixes batch
- **PR #6:** mobile UI parity (admin requests, reports, job roles, employee detail, signup flows)

## Skills Available
- `/scheduler-migrate` — generate + apply a Drizzle migration
- `/scheduler-mobile-sync` — diff web API routes vs mobile api-client
- `/scheduler-pr` — create a PR to Moh's repo
- `/scheduler-seed` — seed test data into Supabase
