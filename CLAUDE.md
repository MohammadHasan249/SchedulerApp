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
- `AI_GATEWAY_API_KEY` (Vercel AI Gateway — powers the AI scheduling assistant)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_GROWTH`, `STRIPE_PRICE_ID_CREDIT` (AI assistant billing — see [Billing](#billing) below; app runs fine without these, billing routes just 503)

**Mobile (`apps/mobile/.env.local`):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL`

Ask a maintainer for current values.

## Deployment
Deploy with `vercel --cwd apps/web` from the repo root after `vercel link`. Required env vars on Vercel: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`.

## Billing
The AI scheduling assistant (`apps/web/app/api/ai/schedule/route.ts`) is metered per-organization: a monthly turn allowance by plan (`apps/web/lib/billing/plan-limits.ts` — tune the numbers there, no other code changes needed), then purchased top-up credits (never expire). Enforcement lives in `apps/web/lib/billing/ai-usage.ts`; org plan/credit state is in the `organization_billing` table with an append-only `credit_transactions` ledger (`packages/database/src/schema/billing.ts`).

Upgrades/top-ups go through Stripe Checkout (`apps/web/app/api/billing/checkout/route.ts`) and a webhook (`apps/web/app/api/billing/webhook/route.ts`) that grants credits / activates the chosen plan on `checkout.session.completed` and syncs plan status on subscription changes. Plans are `starter` (default) and `growth` (matches the landing page pricing section's naming). Prices/products are looked up by ID from env vars in `apps/web/lib/billing/stripe.ts` — create the Products/Prices in the Stripe dashboard, then set `STRIPE_PRICE_ID_STARTER` / `STRIPE_PRICE_ID_GROWTH` / `STRIPE_PRICE_ID_CREDIT`. Credits are sold at a custom quantity chosen by the org (bounded by `MIN_CREDIT_PURCHASE`/`MAX_CREDIT_PURCHASE` in `apps/web/lib/billing/plan-limits.ts`), not fixed packs — `STRIPE_PRICE_ID_CREDIT` must be a Stripe Price with a "per unit" billing scheme. Point a Stripe webhook endpoint at `/api/billing/webhook` and set `STRIPE_WEBHOOK_SECRET` to its signing secret. Admin-facing UI is `/dashboard/settings/billing` (org_admin only).

The billing page also shows recent `credit_transactions` ledger activity (grants/purchases/credit-usage, not raw monthly-allowance usage — see `lib/billing/transactions.ts`) and, once remaining usage (unused allowance + credits) drops to `LOW_BALANCE_THRESHOLD` or below, sends every org_admin a one-time notification via the existing `lib/notifications.ts` pipeline (`lib/billing/notify-low-balance.ts`). The "already notified" flag (`organization_billing.lowBalanceNotifiedAt`) resets on period rollover, credit purchase, or plan upgrade so a later shortage can notify again.

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
