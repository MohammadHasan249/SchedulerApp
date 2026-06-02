/**
 * Converters from raw DB row shapes (Date columns, sensitive fields, jsonb as
 * `unknown`) into the @scheduler/types wire shapes the rest of the app expects.
 *
 * Server components fetch via Drizzle and must pipe rows through these helpers
 * before passing them to client components, otherwise Next.js serializes
 * Dates over the props boundary as ISO strings while TypeScript thinks they're
 * still Date, leading to silent runtime mismatches.
 *
 * Also strips fields that should never reach the client (e.g. `pinHash`).
 */

import type {
  Employee as DbEmployee,
  Shift as DbShift,
  ShiftAssignment as DbShiftAssignment,
  ShiftSwapRequest as DbShiftSwap,
  TimeOffRequest as DbTimeOff,
  JobRole as DbJobRole,
  Branch as DbBranch,
  Notification as DbNotification,
  Organization as DbOrganization,
} from "@scheduler/database/schema";

import type {
  Employee,
  Shift,
  ShiftAssignment,
  ShiftSwapRequest,
  TimeOffRequest,
  JobRole,
  Branch,
  Notification,
  Organization,
  ShiftAssignmentDetail,
} from "@scheduler/types";

export function serializeEmployee(row: DbEmployee): Employee {
  // pinHash MUST NOT leak to the client.
  return {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    authUserId: row.authUserId,
    name: row.name,
    email: row.email,
    role: row.role,
    jobRoleId: row.jobRoleId,
    maxHoursPerWeek: row.maxHoursPerWeek,
    isActive: row.isActive,
    availabilitySchedule:
      (row.availabilitySchedule as Employee["availabilitySchedule"]) ?? null,
  };
}

export function serializeShift(
  row: DbShift,
  assignments?: ShiftAssignmentDetail[]
): Shift {
  return {
    id: row.id,
    branchId: row.branchId,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    isPublished: row.isPublished,
    ...(assignments !== undefined ? { assignments } : {}),
  };
}

export function serializeAssignment(row: DbShiftAssignment): ShiftAssignment {
  return {
    id: row.id,
    shiftId: row.shiftId,
    employeeId: row.employeeId,
    jobRoleId: row.jobRoleId,
  };
}

export function serializeBranch(row: DbBranch): Branch {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    slug: row.slug,
    address: row.address,
    timezone: row.timezone,
  };
}

export function serializeJobRole(row: DbJobRole): JobRole {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
  };
}

export function serializeTimeOff(row: DbTimeOff): TimeOffRequest {
  return {
    id: row.id,
    employeeId: row.employeeId,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeShiftSwap(row: DbShiftSwap): ShiftSwapRequest {
  return {
    id: row.id,
    shiftId: row.shiftId,
    requesterId: row.requesterId,
    coverId: row.coverId,
    managerId: row.managerId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeNotification(row: DbNotification): Notification {
  return {
    id: row.id,
    employeeId: row.employeeId,
    organizationId: row.organizationId,
    message: row.message,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeOrganization(row: DbOrganization): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
  };
}
