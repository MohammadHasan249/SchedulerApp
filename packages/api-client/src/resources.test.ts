import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "./client";
import { getAvailability, saveAvailability } from "./availability";
import { getBranches, createBranch, updateBranch, deleteBranch } from "./branches";
import { getDashboardStats } from "./dashboard";
import { clockPunch, getClockEvents } from "./clock";
import {
  getEmployees,
  getEmployee,
  deleteEmployee,
  inviteEmployee,
  updateEmployee,
  updateEmployeePin,
} from "./employees";
import { setExitPin, verifyExitPin } from "./exitPin";
import { getJobRoles, createJobRole, updateJobRole, deleteJobRole } from "./jobRoles";
import {
  getNotifications,
  markNotificationRead,
  registerPushToken,
  unregisterPushToken,
} from "./notifications";
import {
  getOrganizationInfo,
  getOrganizationHours,
  updateOrganizationHours,
  getOrganizationTheme,
  updateOrganizationTheme,
} from "./organization";
import { getPayRates, createPayRate } from "./payRates";
import {
  getPermissionProfiles,
  createPermissionProfile,
  updatePermissionProfile,
  deletePermissionProfile,
  getMyPermissions,
} from "./permissionProfiles";
import { chatScheduleAI } from "./scheduleAI";
import { getShiftSwaps, createShiftSwap, updateShiftSwap } from "./shiftSwaps";
import {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  assignEmployee,
  unassignEmployee,
  publishShifts,
  getShiftAssignments,
  autoAssignShifts,
} from "./shifts";
import {
  getTimeOffRequests,
  createTimeOffRequest,
  updateTimeOffRequest,
  cancelTimeOffRequest,
} from "./timeOff";

// These resource modules are thin wrappers around apiFetch — this suite just
// confirms each one hits the right path/method/body, catching copy-paste
// errors before they ship to both web and mobile.
vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

const apiFetch = client.apiFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ data: [], nextCursor: null });
});

describe("availability", () => {
  it("getAvailability", () => {
    getAvailability("emp-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/availability/emp-1");
  });

  it("saveAvailability", () => {
    saveAvailability("emp-1", { "1": { startTime: "09:00", endTime: "17:00" } });
    expect(apiFetch).toHaveBeenCalledWith("/api/availability/emp-1", {
      method: "PUT",
      body: JSON.stringify({ "1": { startTime: "09:00", endTime: "17:00" } }),
    });
  });
});

describe("branches", () => {
  it("getBranches", () => {
    getBranches();
    expect(apiFetch).toHaveBeenCalledWith("/api/branches");
  });

  it("createBranch", () => {
    createBranch({ name: "Downtown" });
    expect(apiFetch).toHaveBeenCalledWith("/api/branches", {
      method: "POST",
      body: JSON.stringify({ name: "Downtown" }),
    });
  });

  it("updateBranch", () => {
    updateBranch("b1", { name: "Uptown" });
    expect(apiFetch).toHaveBeenCalledWith("/api/branches/b1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Uptown" }),
    });
  });

  it("deleteBranch", () => {
    deleteBranch("b1");
    expect(apiFetch).toHaveBeenCalledWith("/api/branches/b1", { method: "DELETE" });
  });
});

describe("dashboard", () => {
  it("getDashboardStats", () => {
    getDashboardStats();
    expect(apiFetch).toHaveBeenCalledWith("/api/dashboard/stats");
  });
});

describe("clock", () => {
  it("clockPunch", () => {
    clockPunch("1234", "main");
    expect(apiFetch).toHaveBeenCalledWith("/api/clock", {
      method: "POST",
      body: JSON.stringify({ pin: "1234", branchSlug: "main" }),
    });
  });

  it("getClockEvents unwraps the paginated envelope and builds the query string", async () => {
    apiFetch.mockResolvedValueOnce({ data: [{ id: "e1" }], nextCursor: null });

    const result = await getClockEvents({ branchId: "b1", from: "2026-01-01", to: "2026-01-02" });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/clock?branchId=b1&from=2026-01-01&to=2026-01-02"
    );
    expect(result).toEqual([{ id: "e1" }]);
  });

  it("getClockEvents defaults to an empty array when data is missing", async () => {
    apiFetch.mockResolvedValueOnce({ nextCursor: null });

    const result = await getClockEvents();

    expect(apiFetch).toHaveBeenCalledWith("/api/clock");
    expect(result).toEqual([]);
  });
});

describe("employees", () => {
  it("getEmployees follows the cursor across pages", async () => {
    apiFetch
      .mockResolvedValueOnce({ data: [{ id: "e1" }], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({ data: [{ id: "e2" }], nextCursor: null });

    const result = await getEmployees();

    expect(apiFetch).toHaveBeenNthCalledWith(1, "/api/employees");
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/api/employees?cursor=cursor-2");
    expect(result).toEqual([{ id: "e1" }, { id: "e2" }]);
  });

  it("getEmployees stops if the cursor stops advancing", async () => {
    apiFetch.mockResolvedValue({ data: [{ id: "e1" }], nextCursor: "same" });
    apiFetch.mockImplementation(async () => ({ data: [{ id: "e1" }], nextCursor: "same" }));

    const result = await getEmployees();

    // First page has cursor null; second page returns the same "same"
    // cursor as the request that produced it, so the loop must stop.
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: "e1" }, { id: "e1" }]);
  });

  it("getEmployee", () => {
    getEmployee("e1");
    expect(apiFetch).toHaveBeenCalledWith("/api/employees/e1");
  });

  it("deleteEmployee", () => {
    deleteEmployee("e1");
    expect(apiFetch).toHaveBeenCalledWith("/api/employees/e1", { method: "DELETE" });
  });

  it("inviteEmployee", () => {
    inviteEmployee({ name: "Jane", email: "jane@example.com" });
    expect(apiFetch).toHaveBeenCalledWith("/api/employees", {
      method: "POST",
      body: JSON.stringify({ name: "Jane", email: "jane@example.com" }),
    });
  });

  it("updateEmployee", () => {
    updateEmployee("e1", { isActive: false });
    expect(apiFetch).toHaveBeenCalledWith("/api/employees/e1", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
  });

  it("updateEmployeePin", () => {
    updateEmployeePin("e1", "4321");
    expect(apiFetch).toHaveBeenCalledWith("/api/employees/e1/pin", {
      method: "PATCH",
      body: JSON.stringify({ pin: "4321" }),
    });
  });
});

describe("exitPin", () => {
  it("setExitPin PUTs", () => {
    setExitPin("1234");
    expect(apiFetch).toHaveBeenCalledWith("/api/settings/exit-pin", {
      method: "PUT",
      body: JSON.stringify({ pin: "1234" }),
    });
  });

  it("verifyExitPin POSTs to the same path", () => {
    verifyExitPin("1234");
    expect(apiFetch).toHaveBeenCalledWith("/api/settings/exit-pin", {
      method: "POST",
      body: JSON.stringify({ pin: "1234" }),
    });
  });
});

describe("jobRoles", () => {
  it("getJobRoles", () => {
    getJobRoles();
    expect(apiFetch).toHaveBeenCalledWith("/api/job-roles");
  });

  it("createJobRole", () => {
    createJobRole("Cook");
    expect(apiFetch).toHaveBeenCalledWith("/api/job-roles", {
      method: "POST",
      body: JSON.stringify({ name: "Cook" }),
    });
  });

  it("updateJobRole", () => {
    updateJobRole("r1", "Head Cook");
    expect(apiFetch).toHaveBeenCalledWith("/api/job-roles/r1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Head Cook" }),
    });
  });

  it("deleteJobRole", () => {
    deleteJobRole("r1");
    expect(apiFetch).toHaveBeenCalledWith("/api/job-roles/r1", { method: "DELETE" });
  });
});

describe("notifications", () => {
  it("getNotifications", () => {
    getNotifications();
    expect(apiFetch).toHaveBeenCalledWith("/api/notifications");
  });

  it("markNotificationRead", () => {
    markNotificationRead("n1");
    expect(apiFetch).toHaveBeenCalledWith("/api/notifications/n1", { method: "PATCH" });
  });

  it("registerPushToken", () => {
    registerPushToken("token-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/push-tokens", {
      method: "POST",
      body: JSON.stringify({ token: "token-1" }),
    });
  });

  it("unregisterPushToken", () => {
    unregisterPushToken("token-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/push-tokens", {
      method: "DELETE",
      body: JSON.stringify({ token: "token-1" }),
    });
  });
});

describe("organization", () => {
  it("getOrganizationInfo", () => {
    getOrganizationInfo();
    expect(apiFetch).toHaveBeenCalledWith("/api/org/info");
  });

  it("getOrganizationHours", () => {
    getOrganizationHours();
    expect(apiFetch).toHaveBeenCalledWith("/api/settings/hours");
  });

  it("updateOrganizationHours", () => {
    updateOrganizationHours({ "1": { startTime: "09:00", endTime: "17:00" } });
    expect(apiFetch).toHaveBeenCalledWith("/api/settings/hours", {
      method: "PUT",
      body: JSON.stringify({ "1": { startTime: "09:00", endTime: "17:00" } }),
    });
  });

  it("getOrganizationTheme", () => {
    getOrganizationTheme();
    expect(apiFetch).toHaveBeenCalledWith("/api/org/theme");
  });

  it("updateOrganizationTheme", () => {
    const theme = {
      primary: "#2563eb",
      secondary: "#64748b",
      accent: "#06b6d4",
      background: "#ffffff",
      foreground: "#000000",
    };
    updateOrganizationTheme(theme);
    expect(apiFetch).toHaveBeenCalledWith("/api/org/theme", {
      method: "PATCH",
      body: JSON.stringify(theme),
    });
  });
});

describe("payRates", () => {
  it("getPayRates", () => {
    getPayRates("e1");
    expect(apiFetch).toHaveBeenCalledWith("/api/employees/e1/pay-rates");
  });

  it("createPayRate", () => {
    createPayRate("e1", { payType: "hourly", amountCents: 2150, effectiveDate: "2026-01-01" });
    expect(apiFetch).toHaveBeenCalledWith("/api/employees/e1/pay-rates", {
      method: "POST",
      body: JSON.stringify({ payType: "hourly", amountCents: 2150, effectiveDate: "2026-01-01" }),
    });
  });
});

describe("permissionProfiles", () => {
  it("getPermissionProfiles", () => {
    getPermissionProfiles();
    expect(apiFetch).toHaveBeenCalledWith("/api/permission-profiles");
  });

  it("createPermissionProfile", () => {
    createPermissionProfile({ name: "Shift Lead", permissions: ["salaries:view"] });
    expect(apiFetch).toHaveBeenCalledWith("/api/permission-profiles", {
      method: "POST",
      body: JSON.stringify({ name: "Shift Lead", permissions: ["salaries:view"] }),
    });
  });

  it("updatePermissionProfile", () => {
    updatePermissionProfile("p1", { permissions: ["salaries:edit"] });
    expect(apiFetch).toHaveBeenCalledWith("/api/permission-profiles/p1", {
      method: "PATCH",
      body: JSON.stringify({ permissions: ["salaries:edit"] }),
    });
  });

  it("deletePermissionProfile", () => {
    deletePermissionProfile("p1");
    expect(apiFetch).toHaveBeenCalledWith("/api/permission-profiles/p1", { method: "DELETE" });
  });

  it("getMyPermissions unwraps the permissions array", async () => {
    apiFetch.mockResolvedValueOnce({ permissions: ["salaries:view"] });

    const result = await getMyPermissions();

    expect(apiFetch).toHaveBeenCalledWith("/api/me/permissions");
    expect(result).toEqual(["salaries:view"]);
  });

  it("getMyPermissions defaults to an empty array", async () => {
    apiFetch.mockResolvedValueOnce({});

    const result = await getMyPermissions();

    expect(result).toEqual([]);
  });
});

describe("scheduleAI", () => {
  it("chatScheduleAI", () => {
    const messages = [{ role: "user" as const, content: "hi" }];
    chatScheduleAI(messages);
    expect(apiFetch).toHaveBeenCalledWith("/api/ai/schedule", {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
  });
});

describe("shiftSwaps", () => {
  it("getShiftSwaps", () => {
    getShiftSwaps();
    expect(apiFetch).toHaveBeenCalledWith("/api/shift-swaps");
  });

  it("createShiftSwap", () => {
    createShiftSwap({ shiftId: "s1" });
    expect(apiFetch).toHaveBeenCalledWith("/api/shift-swaps", {
      method: "POST",
      body: JSON.stringify({ shiftId: "s1" }),
    });
  });

  it("updateShiftSwap", () => {
    updateShiftSwap("sw1", "accept_cover");
    expect(apiFetch).toHaveBeenCalledWith("/api/shift-swaps/sw1", {
      method: "PATCH",
      body: JSON.stringify({ action: "accept_cover" }),
    });
  });
});

describe("shifts", () => {
  it("getShifts encodes the weekStart query param", () => {
    getShifts("2026-01-01T00:00:00.000Z");
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/shifts?weekStart=${encodeURIComponent("2026-01-01T00:00:00.000Z")}`
    );
  });

  it("createShift", () => {
    createShift({ branchId: "b1", startTime: "t1", endTime: "t2" });
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts", {
      method: "POST",
      body: JSON.stringify({ branchId: "b1", startTime: "t1", endTime: "t2" }),
    });
  });

  it("updateShift", () => {
    updateShift("s1", { startTime: "t1" });
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts/s1", {
      method: "PATCH",
      body: JSON.stringify({ startTime: "t1" }),
    });
  });

  it("deleteShift", () => {
    deleteShift("s1");
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts/s1", { method: "DELETE" });
  });

  it("assignEmployee", () => {
    assignEmployee("s1", "e1");
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts/s1/assign", {
      method: "POST",
      body: JSON.stringify({ employeeId: "e1" }),
    });
  });

  it("unassignEmployee", () => {
    unassignEmployee("s1", "a1");
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts/s1/assign", {
      method: "DELETE",
      body: JSON.stringify({ assignmentId: "a1" }),
    });
  });

  it("publishShifts", () => {
    publishShifts("b1", "2026-01-01");
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts/publish", {
      method: "POST",
      body: JSON.stringify({ branchId: "b1", weekStart: "2026-01-01" }),
    });
  });

  it("getShiftAssignments", () => {
    getShiftAssignments("s1");
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts/s1/assign");
  });

  it("autoAssignShifts", () => {
    autoAssignShifts("b1", "2026-01-01", "2026-01-07");
    expect(apiFetch).toHaveBeenCalledWith("/api/shifts/auto-assign", {
      method: "POST",
      body: JSON.stringify({ branchId: "b1", fromDate: "2026-01-01", toDate: "2026-01-07" }),
    });
  });
});

describe("timeOff", () => {
  it("getTimeOffRequests", () => {
    getTimeOffRequests();
    expect(apiFetch).toHaveBeenCalledWith("/api/time-off");
  });

  it("createTimeOffRequest", () => {
    createTimeOffRequest({ startDate: "2026-01-01", endDate: "2026-01-05" });
    expect(apiFetch).toHaveBeenCalledWith("/api/time-off", {
      method: "POST",
      body: JSON.stringify({ startDate: "2026-01-01", endDate: "2026-01-05" }),
    });
  });

  it("updateTimeOffRequest", () => {
    updateTimeOffRequest("t1", { status: "approved" });
    expect(apiFetch).toHaveBeenCalledWith("/api/time-off/t1", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    });
  });

  it("cancelTimeOffRequest", () => {
    cancelTimeOffRequest("t1");
    expect(apiFetch).toHaveBeenCalledWith("/api/time-off/t1", { method: "DELETE" });
  });
});
