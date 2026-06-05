# SchedulerApp — Production Readiness Spec

**Version:** 1.0  
**Date:** 2026-06-05

Everything the app needs before it can handle real traffic safely. Organised by category, each item has a priority (P0 = blocking, P1 = ship soon after, P2 = nice-to-have).

---

## 1. Rate Limiting

### Current state
Four in-memory sliding windows (`/lib/utils/rate-limit.ts`) — clock, exit-PIN, PIN-set, and AI. These reset on server restart and don't work across multiple instances.

### What's needed

| # | Item | Priority |
|---|------|----------|
| 1.1 | **Move rate limiting to Redis / Upstash** — replace the in-memory Map with `@upstash/ratelimit` or `ioredis` + sliding window Lua script. In-memory limits are per-process; any multi-instance deploy (Vercel, ECS, etc.) bypasses them entirely. | P0 |
| 1.2 | **Global API rate limit** — add a blanket limit (e.g. 300 req/min per IP) at the edge/middleware layer using Next.js Middleware + Upstash to stop scraping and credential stuffing before they reach route handlers. | P0 |
| 1.3 | **Per-user authenticated rate limit** — for mutating endpoints (invite employee, create shift, etc.) apply a per-`organizationId` limit (e.g. 60 writes/min) to prevent runaway clients or mis-configured automation hammering the DB. | P1 |
| 1.4 | **Retry-After headers** — already present on clock and exit-PIN; audit all rate-limited routes and ensure every 429 response includes a `Retry-After` header so clients back off correctly. | P1 |

---

## 2. Real-Time: WebSockets / SSE / Polling

### Current state
The schedule grid and dashboard have **no real-time updates**. Users must manually refresh to see new shifts, clock events, or request decisions.

### Recommended architecture

**Use Server-Sent Events (SSE)** for read-only push (schedule updates, notifications). SSE is simpler than WebSockets, works over HTTP/2, and is a natural fit for Next.js Route Handlers. Use WebSockets only if bi-directional communication is needed (e.g. collaborative editing).

| # | Item | Priority |
|---|------|----------|
| 2.1 | **Notification feed via SSE** — `GET /api/notifications/stream` opens a persistent SSE connection per user. Push new notification payloads when `createNotification()` is called. Client reconnects with `Last-Event-ID` on disconnect. | P1 |
| 2.2 | **Schedule invalidation events** — when a shift is created/edited/published, emit a channel event (Redis Pub/Sub or Supabase Realtime) so connected schedule grids refetch. Avoids polling entirely for the most-used screen. | P1 |
| 2.3 | **Clock-in live feed (dashboard)** — the admin dashboard stat "Clocked In" is stale. Subscribe to a `clock_events` Supabase Realtime channel to update the count live without a full page refresh. | P1 |
| 2.4 | **Short polling fallback** — for clients that can't maintain SSE (aggressive proxies, some mobile network conditions), provide a `GET /api/notifications?since={timestamp}` endpoint for short polling at ~30 s intervals as a fallback. | P2 |
| 2.5 | **Supabase Realtime for mobile** — the Expo app should subscribe to `shifts`, `shiftAssignments`, and `notifications` channels using Supabase Realtime's Postgres Change events. This removes the need for manual pull-to-refresh on most screens. | P1 |

---

## 3. Performance & Query Optimisation

### Current state
Most queries are unindexed beyond primary keys. No pagination. Some queries (availability page, schedule grid) do O(employees) or O(shifts) full scans.

| # | Item | Priority |
|---|------|----------|
| 3.1 | **Add missing indexes** — critical missing indexes identified: `employees(organizationId, isActive)`, `employees(authUserId)`, `shiftAssignments(employeeId)`, `timeOffRequests(employeeId, status)`, `notifications(employeeId, isRead, createdAt)`, `clockEvents(employeeId, timestamp)` already exists — verify it's being used. | P0 |
| 3.2 | **Paginate employee and clock event lists** — `/api/employees` and `/api/clock` return unbounded result sets. Add cursor-based pagination (`?cursor=<id>&limit=50`) before any org reaches ~500 employees or ~10k clock events. | P0 |
| 3.3 | **Paginate notifications** — `GET /api/notifications` will grow indefinitely. Paginate and add a `markAllRead` bulk endpoint to avoid per-row fetches. | P1 |
| 3.4 | **N+1 query audit** — the schedule grid fetches shifts then assignments in two queries (fine), but `TeamAvailabilityView` maps over all employees individually. Ensure no component is triggering per-employee API calls in a loop. | P1 |
| 3.5 | **Connection pooling** — configure Drizzle/postgres.js with a pool size appropriate for serverless (max 5–10 connections per instance with PgBouncer or Supabase's pooler in transaction mode). Serverless functions with per-request connections will exhaust Postgres `max_connections` under load. | P0 |
| 3.6 | **Cache static org data** — theme, org hours, and job roles rarely change. Cache them at the edge (Next.js `unstable_cache` or `revalidateTag`) with a ~5 min TTL so every page load doesn't hit the DB. | P1 |
| 3.7 | **Parallel data fetching in Server Components** — several pages do sequential `await db...` calls. Wrap independent queries in `Promise.all()` to halve round-trip time. | P1 |

---

## 4. QPS / Throughput Planning

Estimates for a single organisation with ~50 employees across ~3 branches.

| Endpoint | Estimated QPS (peak) | Notes |
|----------|---------------------|-------|
| `GET /api/shifts` | 5–10 | Schedule grid loads, mobile pull-to-refresh |
| `POST /api/clock` | 1–3 | Burst at shift start/end (e.g. 5pm rush) |
| `GET /api/notifications` | 2–5 | Polled if SSE not used |
| `POST /api/ai/schedule` | 0.1 | Already rate-limited at 20/hr/org |
| `GET /api/dashboard/stats` | 1–2 | Loaded on app open |

For a **100-org deployment** (5,000 employees), peak QPS across the platform would be ~500–1,000 req/s. This requires:

| # | Item | Priority |
|---|------|----------|
| 4.1 | **Horizontal scaling** — deploy on Vercel (auto-scales) or containerise with ECS/Fargate behind an ALB. Stateless architecture is already correct (no in-process state except rate limit cache — see §1.1). | P0 |
| 4.2 | **Read replica** — for reporting and availability queries (`GET /api/clock`, `GET /api/availability`), route reads to a Postgres read replica to offload the primary. | P2 |
| 4.3 | **Load test before launch** — run a k6 or Grafana k6 load test simulating 50 concurrent users per org doing schedule loads, clock punches, and shift creation. Establish a baseline p95 latency target (<300ms for reads, <500ms for writes). | P1 |

---

## 5. Security

| # | Item | Priority |
|---|------|----------|
| 5.1 | **Secrets rotation** — `SUPABASE_SERVICE_ROLE_KEY` was shared in chat; rotate it immediately. Establish a secret rotation policy (90-day max). | P0 |
| 5.2 | **Environment variable audit** — ensure no secrets are in `.env.local` committed to the repo. Use Vercel's encrypted env var store or AWS Secrets Manager. | P0 |
| 5.3 | **CSRF protection** — Next.js App Router with cookie-based sessions is vulnerable to CSRF for state-mutating requests. Add `SameSite=Strict` or `Lax` cookies and validate `Origin` header on all mutating API routes. | P0 |
| 5.4 | **Helmet / security headers** — add `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` via `next.config.js` headers. | P0 |
| 5.5 | **Open redirect fix** — verify `/api/auth` redirect destinations are validated against an allowlist (was fixed in PR #10; confirm no regressions). | P0 |
| 5.6 | **Audit log** — write an immutable log of all state-changing actions (shift create/delete, employee invite/deactivate, role change, time-off approve) to a `auditLog` table for compliance and debugging. | P1 |
| 5.7 | **IP allowlisting for kiosk** — optionally restrict `POST /api/clock` to known kiosk IP ranges per branch, reducing brute-force surface further. | P2 |

---

## 6. Observability

| # | Item | Priority |
|---|------|----------|
| 6.1 | **Structured logging** — replace `console.error` calls (org creation, email send failures, etc.) with a structured logger (e.g. Pino) that emits JSON to stdout. Pipe to Datadog, Logtail, or Cloudwatch. | P0 |
| 6.2 | **Error tracking** — integrate Sentry (`@sentry/nextjs` + `@sentry/expo`). Capture unhandled exceptions with org/user context. The `error.tsx` boundary should call `Sentry.captureException(error)` before rendering the fallback UI. | P0 |
| 6.3 | **Metrics** — instrument key business events: shifts created, employees invited, clock punches per hour, AI scheduling requests. Export to Datadog or Prometheus. | P1 |
| 6.4 | **Uptime monitoring** — configure an external health check on `GET /api/health` (to be created — returns DB connectivity status) with alerting on failure. | P1 |
| 6.5 | **Slow query logging** — enable Postgres `log_min_duration_statement = 200ms` and ship slow query logs to the observability stack. | P1 |

---

## 7. Infrastructure

| # | Item | Priority |
|---|------|----------|
| 7.1 | **Database backups** — enable Supabase point-in-time recovery (PITR). Set retention to at least 7 days. Test restore procedure. | P0 |
| 7.2 | **DB migrations in CI** — run `drizzle-kit migrate` as part of the deploy pipeline, not manually. Gate deploys on migration success. | P0 |
| 7.3 | **Staging environment** — create a Vercel preview environment connected to a separate Supabase project. All PRs deploy to staging automatically. | P1 |
| 7.4 | **Redis / Upstash** — required for distributed rate limiting (§1.1) and pub/sub for real-time (§2.2). Provision via Vercel Marketplace. | P0 (once §1.1 is tackled) |
| 7.5 | **CDN for static assets** — Next.js Image and static files should be served via Vercel's edge CDN. Ensure `next/image` is used for all `<img>` tags. | P1 |

---

## 8. Mobile (Expo / React Native)

| # | Item | Priority |
|---|------|----------|
| 8.1 | **Over-the-air updates (OTA)** — configure Expo EAS Update so bug fixes ship to installed apps within minutes without an App Store review cycle. | P1 |
| 8.2 | **Push notifications** — integrate Expo Push Notifications for shift assignments, swap requests, and time-off decisions. Currently only in-app notifications exist. | P1 |
| 8.3 | **Token refresh handling** — ensure the Supabase session is refreshed proactively before expiry in `authStore`; add a global 401 interceptor in `apiFetch` that calls `supabase.auth.refreshSession()` and retries once. | P0 |
| 8.4 | **Offline resilience** — the app currently shows an error on any network failure. Add a local cache (React Query or Zustand persist) so the schedule and last-known data are readable offline. | P2 |
| 8.5 | **App Store compliance** — verify Privacy Manifests, required reason APIs, and `NSCameraUsageDescription` (if any) are present before iOS App Store submission. | P0 (before submission) |
| 8.6 | **Deep linking** — configure universal links so the invitation email link opens the app directly on devices where it's installed. | P1 |

---

## 9. Email

| # | Item | Priority |
|---|------|----------|
| 9.1 | **Retry / queue** — email sends are fire-and-forget (errors are swallowed). Move email to a background job queue (BullMQ + Redis or Trigger.dev) with at-least-once delivery and exponential backoff. | P1 |
| 9.2 | **Email templates** — current HTML is inline strings. Move to React Email or Resend's template system for maintainability and consistent branding. | P2 |
| 9.3 | **SPF / DKIM / DMARC** — configure DNS records for the sending domain before going live to prevent emails landing in spam. Resend provides these. | P0 |
| 9.4 | **Unsubscribe link** — CAN-SPAM and GDPR require a one-click unsubscribe on all non-transactional emails. Add an `emailOptOut` field to `employees` and honour it in all sends. | P1 |

---

## 10. Summary Priority Table

| Priority | Items |
|----------|-------|
| **P0 — Blocking** | Distributed rate limiting (Redis), connection pooling, critical DB indexes, pagination (employees + clock), security headers, CSRF, secrets rotation, DB backups + migrations in CI, token refresh on mobile, structured logging, Sentry |
| **P1 — Ship Soon** | SSE notifications, Supabase Realtime for mobile, per-user rate limits, cache org data, parallel Server Component fetches, load test, audit log, push notifications, OTA updates, email queue, SPF/DKIM |
| **P2 — Nice to Have** | Read replica, IP allowlisting, offline cache, email templates, short-poll fallback |
