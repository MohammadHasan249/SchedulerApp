# SchedulerApp — Claude Session Notes

## What This Is
Multi-tenant employee scheduling SaaS (like Homebase/Deputy).
- **Repo:** `MohammadHasan249/SchedulerApp` (private) — Krayyan is a collaborator
- **Stack:** Turborepo monorepo — `apps/web` (Next.js 15), `apps/mobile` (Expo 54), `packages/`
- **DB:** Supabase (PostgreSQL) + Drizzle ORM
- **Auth:** Supabase Auth (SSR cookies on web, Bearer token on mobile)

## Supabase Project
- **URL:** `https://zloueokwqntzrmckhneg.supabase.co`
- **Publishable key:** `sb_publishable_3kU6rRaEGWHeaG6guLG-qA_rU59jMN5`
- **Secret key:** in 1Password / ask Khaled (do not commit)
- **DATABASE_URL:** `postgresql://postgres:[PASSWORD]@db.zloueokwqntzrmckhneg.supabase.co:5432/postgres`
  - Find password: Supabase dashboard → Settings → Database → Reset database password

## Test Account
- **Email:** `khaledrayyan@outlook.com`
- **Password:** `Test1234!`
- **Role:** org_admin (no branch assigned)

## Bugs Found & Fixed

### 1. Shifts disappear after creating (FIXED — PR #4)
**File:** `apps/web/components/schedule/WeeklyScheduleGrid.tsx`
**Root cause:** `refreshWeek()` called `router.refresh()` which triggered a Next.js server re-render,
temporarily resetting `initialShifts` → `useEffect` fired `setShifts([])` → blank screen.
**Fix:** Replaced `router.refresh()` with a direct `fetch('/api/shifts?weekStart=...')` call that
updates state in-place. PR #4 is open on Moh's repo, awaiting his review.

### 2. Employee invite returns 401 from mobile (ROOT CAUSE FOUND)
**Not a code bug** — Moh's Vercel deployment (`scheduler-dirdzawlx-mohammads-projects-ebb11006.vercel.app`)
has Vercel Deployment Protection enabled. All API requests from the mobile app are intercepted
by Vercel's SSO wall before reaching the app. Fix: deploy our own instance (see below).

### 3. Known code bugs (not yet fixed)
- `employee-signup` uses `listUsers()` — slow at scale
- Auto-assign can double-book (no check for existing assignments)
- Timezone bug: `ShiftCreateDialog` uses local `getDay()`, auto-assign uses `getUTCDay()`
- Invitation email hardcoded to `mohdhasan.dev@gmail.com`
- Notifications are never created anywhere in the codebase
- `OrgContextProvider` wired but `useOrg()` never called — dead code

## Deployment Plan (Our Own Vercel Instance)
Goal: deploy `apps/web` to Krayyan's Vercel account so we don't depend on Moh's deployment.

**Vercel CLI:** installed, authenticated as `krayyan`
**Current branch:** `fix/shift-create-disappear`

### Env vars needed on Vercel:
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zloueokwqntzrmckhneg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_3kU6rRaEGWHeaG6guLG-qA_rU59jMN5` |
| `SUPABASE_SERVICE_ROLE_KEY` | ask Khaled / 1Password |
| `DATABASE_URL` | get from Supabase Connect modal (reset password first) |
| `NEXT_PUBLIC_APP_URL` | set to the Vercel URL after first deploy |
| `RESEND_API_KEY` | optional — needed for invite emails |
| `RESEND_FROM_EMAIL` | optional |
| `DEEPSEEK_API_KEY` | optional — needed for AI scheduling assistant |

### Deploy command (from repo root):
```bash
cd /tmp/SchedulerApp
vercel --cwd apps/web
```

### Supabase MCP
Added to Claude user config:
```
claude mcp add --scope user --transport http supabase "https://mcp.supabase.com/mcp?project_ref=zloueokwqntzrmckhneg"
```
Authentication pending — run `claude /mcp`, select supabase, click Authenticate.
Once authenticated, Claude can fetch DATABASE_URL and other config directly.

## Mobile App Setup
- **Framework:** Expo 54 + React Native + Expo Router
- **Env file:** `apps/mobile/.env.local`
- **API URL:** points to Vercel deployment (update after our own deploy)
- **Login:** `khaledrayyan@outlook.com` / `Test1234!`

### To start Expo dev server:
```bash
cd /tmp/SchedulerApp/apps/mobile
EXPO_NO_PROMPT=1 npx expo start --tunnel
```
Scan QR in Expo Go app, or enter URL manually: `exp://[tunnel-url]`

### Clock-in kiosk:
- Branch slug: `main` or `ottawa`
- Employees with PINs: Mohammad, Dragonfire (branch `c5668a8b`), Fadi, Fadi Rayyan
- Khaled's account has no PIN set — set one via web app employee settings

## Next Steps
1. Get DATABASE_URL (reset Supabase DB password → paste into connection string)
2. Authenticate Supabase MCP (`claude /mcp` → supabase → Authenticate)
3. Run `vercel` from `/tmp/SchedulerApp` to deploy web app
4. Set env vars on Vercel
5. Update `EXPO_PUBLIC_API_URL` in mobile `.env.local` to the new Vercel URL
6. Re-run Expo and test invite + shift creation
