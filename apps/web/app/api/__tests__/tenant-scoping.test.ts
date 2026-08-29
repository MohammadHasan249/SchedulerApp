import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * RLS backstop: the app connects to Postgres via the service-role connection
 * (see packages/database/migrations/0003_fancy_starhawk.sql), which bypasses
 * Postgres RLS entirely. All tenant isolation therefore happens in
 * application code, so there is no database-level safety net if a route
 * forgets to scope a query.
 *
 * This test is that safety net: it statically scans every API route file for
 * references to multi-tenant tables and fails if the file doesn't also
 * reference the column that scopes that table to an organization/branch/
 * employee. It's a heuristic (string search, not real query analysis) — it
 * catches "forgot to scope entirely", not subtle logic bugs — but it turns a
 * silent cross-tenant leak into a build failure.
 *
 * New tenant tables must be added to TENANT_TABLES below. Routes that
 * legitimately query a tenant table without one of the accepted scoping
 * columns (e.g. pre-auth signup flows) must be added to ALLOWLIST with a
 * comment explaining why it's safe.
 */

const API_DIR = join(__dirname, "..");

// table export name -> column names, any one of which must appear in the
// file if the table is referenced. Reflects packages/database/src/schema.
const TENANT_TABLES: Record<string, string[]> = {
  branches: ["organizationId"],
  employees: ["organizationId"],
  jobRoles: ["organizationId"],
  notifications: ["organizationId"],
  permissionProfiles: ["organizationId"],
  shifts: ["branchId"],
  clockEvents: ["branchId"],
  shiftAssignments: ["shiftId", "employeeId"],
  shiftRoleRequirements: ["shiftId"],
  timeOffRequests: ["employeeId"],
  shiftSwapRequests: ["employeeId"],
  payRates: ["employeeId"],
  pushTokens: ["employeeId"],
};

// Routes intentionally exempt, with justification. Path is relative to
// apps/web/app/api.
const ALLOWLIST: Record<string, string> = {
  "auth/employee-signup/route.ts":
    "Pre-auth signup: looks up an employee by org-scoped invite token before a session exists.",
  "org/route.ts": "Org creation/signup: no organization or session exists yet.",
};

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...findRouteFiles(full));
    } else if (entry === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

const IMPORT_RE = /^import\s*\{([^}]+)\}\s*from\s*["']@scheduler\/database\/schema["'];?/m;

describe("tenant scoping backstop", () => {
  const routeFiles = findRouteFiles(API_DIR);
  expect(routeFiles.length).toBeGreaterThan(0);

  for (const filePath of routeFiles) {
    const relPath = relative(API_DIR, filePath).replace(/\\/g, "/");

    it(`${relPath} scopes every tenant table it queries`, () => {
      if (ALLOWLIST[relPath]) return;

      const source = readFileSync(filePath, "utf-8");
      const importMatch = source.match(IMPORT_RE);
      if (!importMatch) return;

      const importedTables = importMatch[1]
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);

      const missing: string[] = [];
      for (const table of importedTables) {
        const scopingColumns = TENANT_TABLES[table];
        if (!scopingColumns) continue; // not a tracked tenant table
        const isScoped = scopingColumns.some((col) => source.includes(col));
        if (!isScoped) missing.push(table);
      }

      if (missing.length > 0) {
        throw new Error(
          `${relPath} references tenant table(s) [${missing.join(", ")}] without any of their ` +
            `required scoping columns (${missing.map((t) => TENANT_TABLES[t].join("/")).join(", ")}). ` +
            `Add the scoping filter, or if this is intentional, add the file to ALLOWLIST in ` +
            `apps/web/app/api/__tests__/tenant-scoping.test.ts with a justification.`
        );
      }
    });
  }
});
