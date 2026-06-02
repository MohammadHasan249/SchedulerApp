import { NextResponse } from "next/server";
import type { AppUser } from "./getUser";

/**
 * Centralized authorization predicates. Routes have been doing inline
 * `if (user.role === "...")` checks, which drift apart (some return 403, some
 * 404; some forget the branch-manager null-branch guard).
 *
 * Each helper either returns void (allowed) or returns a NextResponse the
 * caller should propagate. Helpers do NOT throw — keeps control flow in the
 * route obvious.
 */

export function requireOrgAdmin(user: AppUser): NextResponse | null {
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function requireManagerOrAdmin(user: AppUser): NextResponse | null {
  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Allow only if the user can act on the given branch. Org admins can act on
 * any branch in their org. Branch managers can only act on their assigned
 * branch (and never if their branch is unset). Employees are always denied.
 *
 * Pass `null` for `branchId` to assert "user has at least branch-level scope
 * somewhere in their org" (e.g. for org-wide list endpoints).
 */
export function assertBranchScope(user: AppUser, branchId: string | null): NextResponse | null {
  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === "branch_manager") {
    if (!user.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (branchId !== null && user.branchId !== branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return null;
}
