export type EmployeeRole = "org_admin" | "branch_manager" | "employee";
export type TimeOffStatus = "pending" | "approved" | "denied";

export interface Notification {
  id: string;
  employeeId: string | null;
  organizationId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Employee {
  id: string;
  organizationId: string;
  branchId: string | null;
  authUserId: string | null;
  name: string;
  email: string;
  role: EmployeeRole;
  jobRoleId: string | null;
  maxHoursPerWeek: number | null;
  isActive: boolean;
  availabilitySchedule?: Record<string, { startTime: string; endTime: string }> | null;
  permissionProfileId?: string | null;
}

// ---- Compensation (effective-dated pay history; foundation for T4 generation) ----

export type PayType = "hourly" | "salary";

export interface PayRate {
  id: string;
  employeeId: string;
  payType: PayType;
  /** Minor units (cents). hourly = cents/hour, salary = cents/year. */
  amountCents: number;
  currency: string;
  /** YYYY-MM-DD; the rate active on a day is the latest one with effectiveDate <= day. */
  effectiveDate: string;
  note: string | null;
  createdAt: string;
  createdByEmployeeId: string | null;
}

// ---- Granular permissions ----

export const PERMISSION_KEYS = ["salaries:view", "salaries:edit"] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "salaries:view": "View salaries",
  "salaries:edit": "Edit salaries",
};

export interface PermissionProfile {
  id: string;
  organizationId: string;
  name: string;
  permissions: PermissionKey[];
  createdAt: string;
}

export interface ShiftAssignmentDetail {
  id: string;
  employeeId: string;
  employeeName: string;
  jobRoleId: string | null;
}

export interface Shift {
  id: string;
  branchId: string;
  startTime: string;
  endTime: string;
  isPublished: boolean;
  assignments?: ShiftAssignmentDetail[];
}

export interface ScheduleChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ScheduleChatAction {
  type: "assign_employee";
  assignmentId: string;
  shiftId: string;
  employeeId: string;
}

export interface ShiftAssignment {
  id: string;
  shiftId: string;
  employeeId: string;
  jobRoleId: string | null;
}

export interface AutoAssignResult {
  shiftId: string;
  employeeId: string;
  jobRoleId: string | null;
}

export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time – Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
] as const;

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
}

export type SwapStatus = "pending" | "cover_accepted" | "manager_approved" | "denied";

export interface ShiftSwapRequest {
  id: string;
  shiftId: string;
  requesterId: string;
  coverId: string | null;
  managerId: string | null;
  status: SwapStatus;
  createdAt: string;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: TimeOffStatus;
  createdAt: string;
}

export interface JobRole {
  id: string;
  organizationId: string;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export type OrganizationTheme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
};

// Keys are day-of-week strings "0"–"6". A missing key means the day is closed.
export type HoursSchedule = Record<string, { startTime: string; endTime: string }>;

export const THEME_PRESETS = [
  { key: "blue",    label: "Blue",    primary: "#2563eb" },
  { key: "indigo",  label: "Indigo",  primary: "#4f46e5" },
  { key: "violet",  label: "Violet",  primary: "#7c3aed" },
  { key: "emerald", label: "Emerald", primary: "#059669" },
  { key: "crimson", label: "Crimson", primary: "#d8191f" },
  { key: "amber",   label: "Amber",   primary: "#d97706" },
] as const;

export type ThemePresetKey = typeof THEME_PRESETS[number]["key"];
