# SchedulerApp — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-06-05  
**Status:** Living document

---

## 1. Overview

SchedulerApp is a multi-tenant, cloud-hosted employee scheduling SaaS targeting small-to-medium businesses with shift-based workforces (restaurants, retail, hospitality). It provides a web dashboard for administrators and managers, and a React Native mobile app for all roles including employees. A PIN-based kiosk mode enables physical clock-in/out from any shared device.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Scheduling efficiency** | Reduce time spent building weekly schedules through automation and AI assistance |
| **Employee autonomy** | Let employees manage their own availability, time-off requests, and shift swaps without manager bottlenecks |
| **Real-time visibility** | Give managers a live picture of who is clocked in, what shifts are covered, and what requests are pending |
| **Multi-tenant isolation** | Every organisation's data is strictly isolated; no cross-tenant leakage is acceptable |
| **Mobile-first access** | All core workflows available on iOS and Android via the Expo app |

---

## 3. Users & Roles

| Role | Who | Scope |
|------|-----|-------|
| `org_admin` | Business owner, HR lead | Full access to all branches and all features |
| `branch_manager` | Store / site manager | Access scoped to their assigned branch only |
| `employee` | Team member | Own data only: schedule (published), requests, availability, clock-in |

---

## 4. Features

### 4.1 Authentication & Onboarding

| # | Requirement |
|---|-------------|
| 4.1.1 | Organisations sign up via a dedicated `/signup/org` flow that creates the org, a default branch ("Main"), and the first `org_admin` account in a single DB transaction |
| 4.1.2 | Employees join via invitation email; they click a link that pre-fills their email and lets them set a password |
| 4.1.3 | Session managed by Supabase Auth; JWTs carry `role`, `organization_id`, and `branch_id` in `app_metadata` |
| 4.1.4 | On auth failure the user is redirected to `/auth-error` with a descriptive reason |
| 4.1.5 | Role changes (promotion/demotion) sync to Supabase `app_metadata` atomically within the same DB transaction |

---

### 4.2 Schedule Management

| # | Requirement |
|---|-------------|
| 4.2.1 | Weekly grid view (Mon–Sun) showing shifts per branch; managers/admins see unpublished shifts, employees see only published ones |
| 4.2.2 | Create shift: requires `branchId`, `startTime`, `endTime`; min 15 min, max 24 h; duplicate same-time same-branch shifts are rejected |
| 4.2.3 | Edit shift: start/end time and published status; past shifts are locked (cannot be modified) |
| 4.2.4 | Delete shift: allowed for future shifts only |
| 4.2.5 | Bulk publish: mark all shifts in a given week + branch as published in one action |
| 4.2.6 | Availability overlay: when assigning employees, the dialog shows each employee's availability window for the shift day |
| 4.2.7 | Availability conflict warning: the dialog warns when an employee's availability doesn't cover the shift, but allows manager override |

---

### 4.3 Employee Management

| # | Requirement |
|---|-------------|
| 4.3.1 | Invite employee: name, email, role, branch (optional), job role (optional), max hours/week, optional 4–6 digit PIN |
| 4.3.2 | `branch_manager` can only invite `employee` role, scoped to their own branch |
| 4.3.3 | Only `org_admin` can create or promote to `org_admin` |
| 4.3.4 | PIN is bcrypt-hashed (10 rounds); must be unique per branch |
| 4.3.5 | Edit employee: all fields patchable; role + branch changes sync to Supabase `app_metadata` atomically |
| 4.3.6 | Deactivate employee: soft-delete, bans Supabase auth user, unassigns all future shifts |
| 4.3.7 | New employees default to 9am–11pm availability all 7 days |

---

### 4.4 Availability

| # | Requirement |
|---|-------------|
| 4.4.1 | Each employee stores a weekly recurring availability schedule keyed by day-of-week (0=Sunday … 6=Saturday) |
| 4.4.2 | Employees set their own availability via web or mobile |
| 4.4.3 | Managers and admins see a grid of all team members' availability across all 7 days |
| 4.4.4 | Availability is respected by both manual assignment (warning) and auto-assign (hard block) |

---

### 4.5 Time Off

| # | Requirement |
|---|-------------|
| 4.5.1 | Employees submit requests with `startDate`, `endDate`, optional `reason` |
| 4.5.2 | Constraints: future dates only, max 90 days per request, no overlap with existing pending/approved requests |
| 4.5.3 | Email notification sent to branch manager or org admin on submission |
| 4.5.4 | Managers approve or deny; approved requests unassign the employee from any conflicting shifts |
| 4.5.5 | Status flow: `pending` → `approved` / `denied` |
| 4.5.6 | Employees can cancel their own pending requests |

---

### 4.6 Shift Swaps

| # | Requirement |
|---|-------------|
| 4.6.1 | Employee requests a swap on a future assigned shift; optionally nominates a cover |
| 4.6.2 | Cover accepts; status advances to `cover_accepted` |
| 4.6.3 | Manager approves; actual assignment swap executes atomically in a DB transaction |
| 4.6.4 | Either party or manager can deny at any stage |
| 4.6.5 | Cover must be in the same branch as the shift |
| 4.6.6 | Cannot nominate self as cover |
| 4.6.7 | Status flow: `pending` → `cover_accepted` → `manager_approved` / `denied` |

---

### 4.7 Auto-Assign

| # | Requirement |
|---|-------------|
| 4.7.1 | Algorithm fills unassigned shifts for a given branch + date range |
| 4.7.2 | Respects: employee availability window, approved time-off blocks, `maxHoursPerWeek` cap, job role preferences |
| 4.7.3 | Runs sequentially per shift to prevent double-booking |
| 4.7.4 | Returns number of assignments created |

---

### 4.8 AI Scheduling Assistant

| # | Requirement |
|---|-------------|
| 4.8.1 | Multi-turn chat interface (web + mobile) powered by DeepSeek with tool calling |
| 4.8.2 | Tools exposed: `list_job_roles`, `list_shifts`, `list_employees`, `assign_employee`, `unassign_employee` |
| 4.8.3 | AI-side shift cap: max 10 hours (stricter than the 24-hour API limit) |
| 4.8.4 | Rate limit: 20 requests / hour per organisation |
| 4.8.5 | All assignments made through AI go through the same `validateAssignment` pre-flight as manual assignment |
| 4.8.6 | Feature disabled gracefully when `DEEPSEEK_API_KEY` is not set |

---

### 4.9 Clock In / Out (Kiosk)

| # | Requirement |
|---|-------------|
| 4.9.1 | PIN pad (4-digit) on web (`/kiosk/{slug}`) and mobile clock-in screen |
| 4.9.2 | Auto-detects in/out based on the employee's last event today (in branch timezone) |
| 4.9.3 | Rate limit: 10 attempts / 5 min per IP + branch slug |
| 4.9.4 | PIN collision detection: if two employees share the same PIN, clock-in is refused until resolved |
| 4.9.5 | Dummy bcrypt compare when no candidates exist (timing-attack resistance) |
| 4.9.6 | Kiosk lock mode: full-screen, back-button disabled; exit requires the org-level exit PIN |
| 4.9.7 | Day boundaries use branch timezone, not server timezone |

---

### 4.10 Reports

| # | Requirement |
|---|-------------|
| 4.10.1 | Attendance log of clock events (in/out) for visible branches |
| 4.10.2 | Filter by date range and branch |
| 4.10.3 | Shows employee name, event type, timestamp; ordered newest-first |

---

### 4.11 Settings

| Area | Requirement |
|------|-------------|
| **Organisation hours** | Day-of-week hours of operation; missing day = closed; used as default in availability UI |
| **Theme / branding** | Primary, secondary, accent, background, foreground hex colours; propagated to mobile via API |
| **Branches** | Create/edit with name, slug (unique per org), address, timezone; cannot delete if active employees or upcoming shifts exist |
| **Job roles** | Create/edit named roles (Cook, Waiter, etc.); used in assignments and AI scheduling |
| **Exit PIN** | Org-wide PIN to exit kiosk mode; bcrypt-hashed; rate-limited |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Multi-tenancy** | All queries filter by `organizationId`; cross-tenant data access must be impossible |
| **Authentication** | All API routes are authenticated via `withAuth`; public routes are `/api/auth/*` and `/api/clock` (kiosk) |
| **Input validation** | All API routes validate input with Zod before touching the database; malformed JSON returns 400 |
| **Rate limiting** | Clock endpoint: 10/5 min; AI endpoint: 20/hr; PIN-set endpoint: 5/5 min; Exit PIN: 10/5 min |
| **Atomic writes** | Org creation, employee role change, and shift-swap approval all use DB transactions |
| **Error boundaries** | Web: `error.tsx` catches unhandled component errors; API: all routes return typed JSON errors |
| **Timezone** | All date comparisons for clock-in use the branch's configured timezone |

---

## 6. Data Model Summary

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant root; holds theme, hours, exit PIN hash |
| `branches` | Locations within an org; holds timezone, slug |
| `employees` | All users; holds role, PIN hash, availability JSON, max hours |
| `jobRoles` | Named role templates per org |
| `shifts` | Time slots per branch |
| `shiftAssignments` | Employee ↔ shift mapping (unique per employee+shift) |
| `shiftRoleRequirements` | Headcount requirements per shift + job role |
| `timeOffRequests` | Vacation requests with status |
| `shiftSwapRequests` | Swap workflow with 4-state status |
| `clockEvents` | Immutable clock-in/out log |
| `notifications` | In-app notification feed |

---

## 7. Out of Scope (v1)

- Payroll integration
- Recurring shift templates
- Shift bidding / open shift marketplace
- Push notifications (mobile)
- Multi-language support
- Offline mode
- Customer-facing booking

---

## 8. Open Questions

- Should employees be able to view colleagues' schedules, or only their own?
- Should the AI assistant be able to create new shifts, or only assign employees to existing ones?
- Is there a plan for a free tier vs. paid tier feature split?
