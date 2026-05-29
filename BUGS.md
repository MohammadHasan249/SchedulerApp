# SchedulerApp Bug Audit

Audited 2026-05-29 on branch `fix/shift-create-disappear`. Findings ordered by severity.

---

## CRITICAL — Feature is broken

### 1. Shift swap "manager approval" doesn't actually swap anyone
**File:** `apps/web/app/api/shift-swaps/[id]/route.ts:106-115`

When a manager approves a swap, the code only updates `shiftSwapRequests.status` to `"manager_approved"`. It **never** deletes the requester's assignment or creates an assignment for the cover. The entire swap feature is non-functional — approved swaps leave the original employee assigned and the cover unscheduled.

**Fix:** Wrap the status update in a transaction that:
1. Deletes `shiftAssignments` for `(shiftId, requesterId)`
2. Inserts `shiftAssignments` for `(shiftId, coverId, jobRoleId)`
3. Updates the swap row

---

### 2. Notifications table exists but is never written
**File:** `packages/database/src/schema/notifications.ts` exists; zero `db.insert(notifications)` calls anywhere in the codebase.

The notification bell, the read/unread toggle, the `/api/notifications` GET — all dead-ended. Users never see any notifications because nothing ever creates one. Time-off approvals, shift assignments, swap responses — nothing notifies anyone in-app.

**Fix:** Add `db.insert(notifications)` calls at write sites: time-off PATCH, shift assignment POST, swap state transitions, employee invite.

---

### 3. `sendEmployeeInvitationEmail` uses wrong Supabase client → silently broken
**File:** `apps/web/lib/email/send-employee-invitation.ts:42-49`

```ts
const supabase = await createClient();    // cookie-scoped server client
const { data: users } = await supabase.auth.admin.listUsers();   // needs service role
```

`supabase.auth.admin.*` requires the service-role key. The cookie-scoped client doesn't have it, so this call always errors. The `try/catch` swallows the error and sets `userExists = false`, so every invitee receives the "Create Account" email even if they already exist.

It also uses `listUsers()` which is the slow-at-scale anti-pattern the team explicitly removed from `employee-signup`.

**Fix:** Use `createAdminClient()` and replace `listUsers()` with `getUserByEmail()` or a query against the `employees` table.

---

### 4. Shift assignment has no uniqueness constraint
**File:** `packages/database/src/schema/shifts.ts:16-25` — `shift_assignments` table has no unique index on `(shift_id, employee_id)`.

Consequences:
- `POST /api/shifts/[id]/assign` (`apps/web/app/api/shifts/[id]/assign/route.ts:87`) inserts with no de-dup check
- Auto-assign run twice on the same unpublished shift will pile up duplicate assignments (see #5)
- The AI tool `toolAssignEmployee` (`apps/web/app/api/ai/schedule/route.ts:390`) inserts with no de-dup check
- Same employee can end up assigned to the same shift 2+ times → hours double-counted → cascading errors

**Fix:** Add `unique("shift_assignments_shift_emp_unique").on(t.shiftId, t.employeeId)` to the schema and a migration.

---

### 5. Auto-assign double-books on re-run
**File:** `apps/web/lib/scheduling/auto-assign.ts:39-49`

`unassignedShifts` is built with `eq(shifts.isPublished, false)` only — it doesn't check whether assignments already exist. The `assignedEmployeeSet` tracks only employees assigned in *this* run, starting empty each time. So a shift that already has 3 employees from a previous auto-assign run will get 3 *more* on the next run (combined with #4, the same employees can be re-added).

**Fix:** When building `unassignedShifts`, left-join `shiftAssignments` and exclude shifts that already meet their `shiftRoleRequirements.headcount`. Or pre-load existing assignments into `assignedEmployeeSet` per shift.

---

### 6. Clock-in PIN matches the wrong employee on collision
**File:** `apps/web/app/api/clock/route.ts:105-115` + `packages/database/src/schema/employees.ts` (no unique on `pin_hash`).

PINs aren't unique per branch/org. The clock-in code bcrypt-compares the entered PIN against every employee in the branch and breaks on the first match. Two employees can pick the same PIN; whichever the DB returns first wins. The "wrong person" gets clocked in silently, with no error.

**Fix:** Enforce PIN uniqueness per branch at the API level (during PIN set/update, reject if collision). DB-level uniqueness is harder because the hash differs per salt — must be enforced in app code via "compare incoming PIN against all hashes; reject if >1 match."

---

## HIGH — Security / data integrity

### 7. XSS-via-email in invitation template
**File:** `apps/web/lib/email/send-employee-invitation.ts:82-110, 130-160`

`employeeName` and `org.name` are interpolated into HTML without escaping. The sibling file `send-time-off-notification.ts` has an `escapeHtml` helper — invitation file forgot to use it. An attacker who controls an employee name or org name can inject HTML/CSS into the welcome email.

**Fix:** Apply the same `escapeHtml` helper to all template variables.

---

### 8. Deactivated employee can still log in
**File:** `apps/web/app/api/employees/[id]/route.ts:139-158`

DELETE soft-deletes by setting `isActive = false`, but does not call `supabase.auth.admin.updateUserById(authUserId, { ban_duration: '...' })` or invalidate the user's JWT. The deactivated user retains their session, can keep hitting the API, and many endpoints don't check `isActive`.

**Fix:** Either ban the Supabase auth user on deactivate, or have every API route filter by `isActive`. Banning is simpler and cleaner.

---

### 9. PATCH employee desyncs Supabase metadata and DB on failure
**File:** `apps/web/app/api/employees/[id]/route.ts:116-134`

Order of operations: (1) call `supabase.auth.admin.updateUserById` with the new role/branch, (2) then `db.update(employees)`. If the DB update fails after the metadata update succeeds, JWT claims show the new role/branch but DB shows old. JWT is authoritative for permission checks in `getApiUser`, so users get the new permissions without the DB ever recording the change.

**Fix:** Reverse the order (DB first, then metadata sync), or wrap in a try/catch that rolls back the metadata change on DB failure.

---

### 10. Org creation has no transaction → orphan auth users on partial failure
**File:** `apps/web/app/api/org/route.ts:42-79`

The signup flow runs four sequential operations: `INSERT organizations`, `INSERT branches`, `createUser` (Supabase auth), `INSERT employees`. The first failure path rolls back the org row, but if the `employees` insert (line 73) fails, the auth user is left orphaned — they exist in Supabase auth but have no employee record, so subsequent login appears to "work" but every API call fails because `parseAppUser` can't find their employee row.

**Fix:** Wrap DB writes in a `db.transaction()` and clean up the Supabase auth user on any failure after `createUser`.

---

### 11. No assignment validity checks in manual assign
**File:** `apps/web/app/api/shifts/[id]/assign/route.ts:87-94`

`POST /api/shifts/[id]/assign` inserts an assignment with zero validation:
- Doesn't check the employee is `isActive`
- Doesn't check the employee has approved time-off on the shift date
- Doesn't check the employee has another shift overlapping
- Doesn't check the employee's `maxHoursPerWeek`
- Doesn't check the shift fits the employee's `availabilitySchedule`

(The AI tool `toolAssignEmployee` does enforce these — manual UI bypasses all of them.)

**Fix:** Extract the AI tool's constraint checks into a shared helper and call it from both code paths.

---

### 12. Shift create has no validation
**File:** `apps/web/app/api/shifts/route.ts:94-131`

`POST /api/shifts` accepts any `startTime`/`endTime` pair. No check that `endTime > startTime`, no check on max duration, no check that the shift isn't in the past, no check for overlap with existing shifts at the same branch.

**Fix:** Add: `startTime < endTime`, duration ≤ some sane max (24h?), reject overlap if both shifts are at the same branch and have any time intersection.

---

### 13. Time-off requests have no validation or overlap check
**File:** `apps/web/app/api/time-off/route.ts:59-91`

POST accepts past dates, accepts duplicate/overlapping requests for the same employee, has no max duration. Also: approving time-off doesn't auto-unassign the employee from any conflicting shifts (`apps/web/app/api/time-off/[id]/route.ts:42-46`) — they remain scheduled.

**Fix:** Reject past dates, reject overlap with existing pending/approved requests, and on approval cascade-unassign conflicting shifts.

---

### 14. Employee email is not unique
**File:** `packages/database/src/schema/employees.ts:11-30` — no unique constraint on `email` (per-org or global).

`employee-signup` looks up the row with `.where(eq(employees.email, email))` and returns the first one. If duplicate invites for the same email exist (in the same or different orgs), signup links the auth user to one randomly, and the others become unreachable.

**Fix:** Unique constraint on `(organization_id, email)`. Globally-unique is too restrictive (legitimate cross-org overlap exists), but per-org overlap is a bug.

---

## MEDIUM — Behavioral / UX

### 15. Mobile SecureStore "minimal session" optimization is dead code
**File:** `apps/mobile/lib/supabase.ts:7-29`

The adapter checks `if (key === "sb-auth-token")` — but Supabase actually uses keys like `sb-zloueokwqntzrmckhneg-auth-token` (project-ref prefixed). The hardcoded equality never matches, so the minimal-stripping branch never runs. Full session (including user object) is always stored. Harmless today, but if a session ever exceeds the iOS SecureStore 2 KB-per-key limit the silently-failing fallback will corrupt auth state.

**Fix:** Match by `startsWith("sb-") && endsWith("-auth-token")`, or just remove the dead optimization.

---

### 16. Mobile API errors silently swallowed across the entire app
**Files:** `apps/mobile/app/(tabs)/dashboard.tsx:62-68`, `schedule.tsx:38-55, 90-115`, `employees.tsx:114-124`, plus most others

Every screen catches API errors with `try { ... } catch { /* silent */ }`. The dashboard ignores stat-load failures, the schedule ignores assign/unassign failures, etc. When the backend is down or returns 401 (as it does right now behind Vercel Deployment Protection), the user sees stale data and no indication anything is wrong.

**Fix:** Show a toast/banner on API failure. Even a generic "Couldn't load — pull to refresh" is better than silent staleness.

---

### 17. Validation errors render as `[object Object]` to web users
**File:** `apps/web/components/employees/EmployeeForm.tsx:92-97` and similar pattern in other forms.

Server returns `{ error: parsed.error.flatten() }` for Zod validation failures (object shape `{ fieldErrors, formErrors }`). The client falls back to `data.error` when `formErrors[0]` is absent, then renders that as a string — producing the classic `[object Object]`. Field-level validation errors are unreadable.

**Fix:** Either return a flat error string from the server, or render `data.error.fieldErrors` field-by-field on the client.

---

### 18. Mobile invite "Invitation sent" alert lies when Resend isn't configured
**File:** `apps/mobile/app/(tabs)/employees.tsx:156`

`Alert.alert("Invited", "An invitation email has been sent to …")` fires unconditionally on success. The actual send is fire-and-forget on the server (`apps/web/app/api/employees/route.ts:129`) and silently no-ops when `RESEND_API_KEY` is missing. User believes the email went out when it didn't.

**Fix:** Server should return `{ employee, emailSent: boolean }`; mobile should adjust the toast accordingly.

---

### 19. Routes that wrap `withAuth` but never call `getUser` are effectively public
**File:** `apps/web/lib/auth/withAuth.ts:5-15`

`withAuth` only converts a thrown `ApiAuthError` from `getUser()` into a 401. If a handler never calls `getUser()`, no auth check happens despite the wrapper. The clock POST route (`apps/web/app/api/clock/route.ts:60-150`) does this — and that's actually correct for a kiosk endpoint, but it's confusing and easy to write a "protected" route that isn't.

**Fix:** Rename `withAuth` to `withAuthErrors` or similar; have the wrapper itself call `getUser()` if the intent is to require auth.

---

### 20. Branch deletion silently strands branch managers
**File:** `apps/web/app/api/branches/[id]/route.ts:60-72`

DELETE has no warning about cascade. When a branch is deleted:
- All its shifts cascade-delete (data loss, no confirmation)
- Employees become `branchId: null` (schema onDelete: "set null")
- Branch managers' JWT `app_metadata.branch_id` still points at the dead branch
- Worse: in `apps/web/app/api/ai/schedule/route.ts:113`, branch managers with `!user.branchId` silently fall through to **all-branch** access — accidental privilege escalation

**Fix:** Refuse delete if branch is referenced by any branch_manager; or auto-promote/notify them. Definitely fix the AI route fall-through.

---

### 21. `router.refresh()` flash pattern lives in other forms too
The fix already shipped for `WeeklyScheduleGrid` (PR #4). Same pattern still in:
- `apps/web/components/employees/EmployeeForm.tsx:101` — less impact because `EmployeeTable` reads `employees` directly from props (server component re-renders cleanly)
- `apps/web/components/employees/EmployeeTable.tsx:50, 59` — same

These ones don't show the disappearing bug, but the brittleness pattern remains.

**Fix:** Use optimistic updates or direct API refetch like we did for shifts.

---

## LOW — Polish / minor

- **AI tool JSON parse not protected** — `apps/web/app/api/ai/schedule/route.ts:496` parses tool-call args with no try/catch. Malformed args crash the whole conversation.
- **AI route has no rate limit or token cap** — expensive endpoint, no protection. Client-controlled message history.
- **`x-org-slug` header set but never read** — `middleware.ts:13` dead code.
- **Org signup creates "Main" branch unconditionally** — fine, but if the org-creating admin already has a real branch name in mind they'll have a useless "Main" cluttering the dashboard.
- **`shiftRoleRequirements` has no unique constraint on `(shift_id, job_role_id)`** — could create duplicate role requirements.
- **`new Date().toDateString()` in AI system prompt** — uses server local time (UTC on Vercel) which may not match the user's "today".
- **Org admin can demote themselves** — no protection against an org ending up with zero admins.

---

## Bugs from prior memory that are NO LONGER present

For reference — these were on the old list but the code has moved on:
- `employee-signup` using `listUsers()` — **fixed** (it now uses `createUser` directly)
- `ShiftCreateDialog` `getDay()` vs auto-assign `getUTCDay()` — **fixed**, both use `getDay()` now
- Hardcoded `mohdhasan.dev@gmail.com` recipient — **fixed**, now resolves branch manager/org admin
- `OrgContextProvider` dead code — **fixed**, `useOrg()` is used in `ThemeInjector.tsx`
- Shifts disappear after create — **fixed** by us, PR #4
