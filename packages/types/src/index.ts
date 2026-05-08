export type EmployeeRole = "org_admin" | "branch_manager" | "employee";
export type TimeOffStatus = "pending" | "approved" | "rejected";

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
}

export interface Shift {
  id: string;
  branchId: string;
  startTime: string;
  endTime: string;
  isPublished: boolean;
}

export interface ShiftAssignment {
  id: string;
  shiftId: string;
  employeeId: string;
  jobRoleId: string | null;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
}

export interface Availability {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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
}

export interface JobRole {
  id: string;
  organizationId: string;
  name: string;
  color: string | null;
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

export const THEME_PRESETS = [
  { key: "blue",    label: "Blue",    primary: "#2563eb" },
  { key: "indigo",  label: "Indigo",  primary: "#4f46e5" },
  { key: "violet",  label: "Violet",  primary: "#7c3aed" },
  { key: "emerald", label: "Emerald", primary: "#059669" },
  { key: "rose",    label: "Rose",    primary: "#e11d48" },
  { key: "amber",   label: "Amber",   primary: "#d97706" },
] as const;

export type ThemePresetKey = typeof THEME_PRESETS[number]["key"];
