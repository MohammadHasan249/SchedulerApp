export type EmployeeRole = "org_admin" | "branch_manager" | "employee";
export type TimeOffStatus = "pending" | "approved" | "denied";

export * from "./scheduleChat";

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

export interface TimezoneOption {
  value: string;
  label: string;
}

// Used only if the runtime doesn't support Intl.supportedValuesOf.
const FALLBACK_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
  "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
  "America/Toronto", "America/Vancouver", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Kolkata", "Europe/London", "Europe/Paris", "Australia/Sydney", "UTC",
];

function cityName(tz: string): string {
  if (tz === "UTC") return "UTC";
  return tz.split("/").pop()!.replace(/_/g, " ");
}

// "America" as a region label reads as "United States" to most people, when
// it's actually the continent (Toronto and Vancouver are both "America/...").
// Standard timezone pickers instead lead with the UTC offset, which is
// unambiguous and lets the list sort geographically west-to-east.
function getOffsetMinutes(tz: string): number {
  if (tz === "UTC") return 0;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(new Date());
  const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const [, sign, hh, mm] = match;
  const minutes = Number(hh) * 60 + Number(mm);
  return sign === "-" ? -minutes : minutes;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/**
 * Every IANA timezone the runtime knows about, labeled by its UTC offset and
 * city (e.g. "(UTC-04:00) Toronto"), sorted by offset then city name. A
 * disambiguator (the region path, e.g. "America/Indiana") is appended only
 * when two zones would otherwise share the same city name. Falls back to a
 * short curated list on engines without Intl.supportedValuesOf.
 */
export function getTimezoneOptions(): TimezoneOption[] {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;

  const cityCounts = new Map<string, number>();
  for (const tz of zones) {
    const city = cityName(tz);
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }

  return zones
    .map((value) => {
      const offsetMinutes = getOffsetMinutes(value);
      const city = cityName(value);
      const parts = value.split("/");
      const region = parts.length > 1 ? parts.slice(0, -1).join("/").replace(/_/g, " ") : "";
      const name = region && (cityCounts.get(city) ?? 0) > 1 ? `${city} (${region})` : city;
      return { value, label: `(${formatOffset(offsetMinutes)}) ${name}`, offsetMinutes, city };
    })
    .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city))
    .map(({ value, label }) => ({ value, label }));
}

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
  /** Only populated for an employee's own view (GET /api/shift-swaps) — the
   *  other party's name on a swap they're already part of, not the roster. */
  requesterName?: string | null;
  coverName?: string | null;
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

export interface SchedulingRule {
  id: string;
  branchId: string;
  ruleText: string;
  isActive: boolean;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
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
