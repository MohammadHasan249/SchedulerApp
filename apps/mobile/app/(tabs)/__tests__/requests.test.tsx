import React from "react";
import { Alert } from "react-native";
import { format } from "date-fns";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import RequestsScreen from "../requests";
import {
  getTimeOffRequests,
  createTimeOffRequest,
  updateTimeOffRequest,
  getShiftSwaps,
  createShiftSwap,
  updateShiftSwap,
  getShifts,
  getShiftAssignments,
  getEmployees,
} from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import type { TimeOffRequest, ShiftSwapRequest, Shift, Employee } from "@scheduler/types";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/api", () => ({
  getTimeOffRequests: jest.fn(),
  createTimeOffRequest: jest.fn(),
  updateTimeOffRequest: jest.fn(),
  getShiftSwaps: jest.fn(),
  createShiftSwap: jest.fn(),
  updateShiftSwap: jest.fn(),
  getShifts: jest.fn(),
  getShiftAssignments: jest.fn(),
  getEmployees: jest.fn(),
}));

jest.mock("@/lib/myEmployeeStore", () => ({
  useMyEmployeeStore: jest.fn(),
}));

function sessionWith(app_metadata: Record<string, unknown>): Session {
  return { user: { id: "auth-1", app_metadata } } as unknown as Session;
}

function makeTimeOff(overrides: Partial<TimeOffRequest> = {}): TimeOffRequest {
  return {
    id: "to-1",
    employeeId: "emp-1",
    startDate: "2026-02-01",
    endDate: "2026-02-05",
    reason: null,
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as TimeOffRequest;
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    organizationId: "org-1",
    branchId: null,
    authUserId: "auth-1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "employee",
    jobRoleId: null,
    maxHoursPerWeek: 40,
    isActive: true,
    ...overrides,
  } as Employee;
}

function makeShift(overrides: Partial<Shift> = {}): Shift {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  return {
    id: "shift-1",
    branchId: "branch-1",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    isPublished: true,
    assignments: [],
    ...overrides,
  } as Shift;
}

function makeSwap(overrides: Partial<ShiftSwapRequest> = {}): ShiftSwapRequest {
  return {
    id: "swap-1",
    shiftId: "shift-1",
    requesterId: "emp-1",
    coverId: null,
    managerId: null,
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as ShiftSwapRequest;
}

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

describe("RequestsScreen", () => {
  const fetchMyEmployee = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (useMyEmployeeStore as unknown as jest.Mock).mockReturnValue({ fetchMyEmployee });
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getShifts as jest.Mock).mockResolvedValue([]);
    (getShiftAssignments as jest.Mock).mockResolvedValue([]);
    (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);
  });

  describe("Time Off — employee", () => {
    beforeEach(() => {
      useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
    });

    it("shows the empty state", async () => {
      (getTimeOffRequests as jest.Mock).mockResolvedValue([]);

      const { findByText } = await render(<RequestsScreen />);

      expect(await findByText("No time-off requests")).toBeTruthy();
    });

    it("renders a request with its date range and status", async () => {
      (getTimeOffRequests as jest.Mock).mockResolvedValue([makeTimeOff()]);

      const { findByText } = await render(<RequestsScreen />);

      expect(await findByText("Feb 1 – Feb 5, 2026")).toBeTruthy();
      expect(await findByText("Pending")).toBeTruthy();
    });

    it("shows an alert when loading fails", async () => {
      (getTimeOffRequests as jest.Mock).mockRejectedValue(new Error("network down"));

      await render(<RequestsScreen />);

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith("Couldn't load time-off requests", "network down")
      );
    });

    it("validates required dates before submitting", async () => {
      (getTimeOffRequests as jest.Mock).mockResolvedValue([]);

      const { findByText, getByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests");

      await fireEvent.press(getByText("+ Request"));
      await fireEvent.press(getByText("Submit Request"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        "Please fill in start and end dates (YYYY-MM-DD)"
      );
      expect(createTimeOffRequest).not.toHaveBeenCalled();
    });

    it("submits a valid request and reloads", async () => {
      (getTimeOffRequests as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeTimeOff()]);
      (createTimeOffRequest as jest.Mock).mockResolvedValue(makeTimeOff());

      const { findByText, getByText, getAllByPlaceholderText, queryByText } = await render(
        <RequestsScreen />
      );
      await findByText("No time-off requests");

      await fireEvent.press(getByText("+ Request"));
      const [startInput, endInput] = getAllByPlaceholderText("YYYY-MM-DD");
      await fireEvent.changeText(startInput, "2026-02-01");
      await fireEvent.changeText(endInput, "2026-02-05");
      await fireEvent.press(getByText("Submit Request"));

      await waitFor(() =>
        expect(createTimeOffRequest).toHaveBeenCalledWith({
          startDate: "2026-02-01",
          endDate: "2026-02-05",
          reason: undefined,
        })
      );
      await waitFor(() => expect(queryByText("Submit Request")).toBeNull());
      expect(getTimeOffRequests).toHaveBeenCalledTimes(2);
    });
  });

  describe("Time Off — admin", () => {
    beforeEach(() => {
      useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });
    });

    it("does not show the '+ Request' button", async () => {
      (getTimeOffRequests as jest.Mock).mockResolvedValue([]);

      const { findByText, queryByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests from your team");

      expect(queryByText("+ Request")).toBeNull();
    });

    it("shows pending requests with the employee's name and approve/deny actions", async () => {
      (getTimeOffRequests as jest.Mock).mockResolvedValue([makeTimeOff()]);

      const { findByText } = await render(<RequestsScreen />);

      expect(await findByText("Pending (1)")).toBeTruthy();
      expect(await findByText("Jane Doe")).toBeTruthy();
      expect(await findByText("Approve")).toBeTruthy();
      expect(await findByText("Deny")).toBeTruthy();
    });

    it("approving a request calls the API with status 'approved' and reloads", async () => {
      (getTimeOffRequests as jest.Mock)
        .mockResolvedValueOnce([makeTimeOff()])
        .mockResolvedValueOnce([makeTimeOff({ status: "approved" })]);
      (updateTimeOffRequest as jest.Mock).mockResolvedValue(undefined);

      const { findByText, getByText } = await render(<RequestsScreen />);
      await fireEvent.press(await findByText("Approve"));

      await waitFor(() =>
        expect(updateTimeOffRequest).toHaveBeenCalledWith("to-1", { status: "approved" })
      );
      expect(getTimeOffRequests).toHaveBeenCalledTimes(2);
    });

    it("denying a request calls the API with status 'denied'", async () => {
      (getTimeOffRequests as jest.Mock).mockResolvedValue([makeTimeOff()]);
      (updateTimeOffRequest as jest.Mock).mockResolvedValue(undefined);

      const { findByText } = await render(<RequestsScreen />);
      await fireEvent.press(await findByText("Deny"));

      await waitFor(() =>
        expect(updateTimeOffRequest).toHaveBeenCalledWith("to-1", { status: "denied" })
      );
    });
  });

  describe("Swap Shifts — employee", () => {
    beforeEach(() => {
      useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
      (getTimeOffRequests as jest.Mock).mockResolvedValue([]);
    });

    it("shows the empty state", async () => {
      (getShiftSwaps as jest.Mock).mockResolvedValue([]);

      const { findByText, getByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests");
      await fireEvent.press(getByText("Swap Shifts"));

      expect(await findByText("No swap requests")).toBeTruthy();
    });

    it("shows an alert when loading swaps fails", async () => {
      (getShiftSwaps as jest.Mock).mockRejectedValue(new Error("network down"));

      const { findByText, getByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests");
      await fireEvent.press(getByText("Swap Shifts"));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith("Couldn't load swap requests", "network down")
      );
    });

    it("offers only the employee's own assigned upcoming shifts when requesting a swap", async () => {
      const myShift = makeShift({
        id: "mine",
        assignments: [{ id: "a1", employeeId: "emp-1", employeeName: "Jane Doe", jobRoleId: null }],
      });
      const otherShift = makeShift({
        id: "other",
        assignments: [{ id: "a2", employeeId: "emp-2", employeeName: "Bob", jobRoleId: null }],
      });
      (getShiftSwaps as jest.Mock).mockResolvedValue([]);
      (getShifts as jest.Mock).mockResolvedValueOnce([myShift, otherShift]).mockResolvedValueOnce([]);

      const { findByText, getByText, queryAllByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests");
      await fireEvent.press(getByText("Swap Shifts"));
      await findByText("No swap requests");

      await fireEvent.press(getByText("+ Request"));
      await findByText("Select a shift to swap");

      // Both shifts start at the same time of day, so only one picker row
      // (the employee's own shift) should be present.
      const dayLabel = format(new Date(myShift.startTime), "EEE, MMM d");
      expect(queryAllByText(dayLabel).length).toBe(1);
    });

    it("requesting a swap for a shift calls createShiftSwap with the shift id", async () => {
      const myShift = makeShift({
        id: "mine",
        assignments: [{ id: "a1", employeeId: "emp-1", employeeName: "Jane Doe", jobRoleId: null }],
      });
      (getShiftSwaps as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([makeSwap()]);
      (getShifts as jest.Mock)
        .mockResolvedValueOnce([myShift])
        .mockResolvedValueOnce([])
        .mockResolvedValue([myShift]);
      (createShiftSwap as jest.Mock).mockResolvedValue(makeSwap());

      const { findByText, getByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests");
      await fireEvent.press(getByText("Swap Shifts"));
      await findByText("No swap requests");
      await fireEvent.press(getByText("+ Request"));

      const dayLabel = format(new Date(myShift.startTime), "EEE, MMM d");
      await fireEvent.press(await findByText(dayLabel));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Request Swap",
        expect.any(String),
        expect.any(Array)
      );
      const confirmBtn = alertButtons().find((b) => b.text === "Request");
      await act(async () => { await confirmBtn?.onPress?.(); });

      await waitFor(() =>
        expect(createShiftSwap).toHaveBeenCalledWith({ shiftId: "mine" })
      );
    });

    it("lets an assigned cover accept a pending swap", async () => {
      const swap = makeSwap({ status: "pending", requesterId: "emp-2", coverId: "emp-1" });
      (getShiftSwaps as jest.Mock)
        .mockResolvedValueOnce([swap])
        .mockResolvedValueOnce([{ ...swap, status: "cover_accepted" }]);
      (getShifts as jest.Mock)
        .mockResolvedValueOnce([makeShift()])
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);
      (updateShiftSwap as jest.Mock).mockResolvedValue(undefined);

      const { findByText, getByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests");
      await fireEvent.press(getByText("Swap Shifts"));

      await fireEvent.press(await findByText("Accept Swap"));

      await waitFor(() =>
        expect(updateShiftSwap).toHaveBeenCalledWith("swap-1", "accept_cover")
      );
    });
  });

  describe("Swap Shifts — admin", () => {
    beforeEach(() => {
      useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });
      (getTimeOffRequests as jest.Mock).mockResolvedValue([]);
    });

    it("shows manager approve/deny for a swap awaiting manager decision", async () => {
      const swap = makeSwap({ status: "cover_accepted", coverId: "emp-2" });
      (getShiftSwaps as jest.Mock).mockResolvedValue([swap]);
      (getShifts as jest.Mock).mockResolvedValue([makeShift()]);
      (getEmployees as jest.Mock).mockResolvedValue([
        makeEmployee({ id: "emp-1", name: "Jane Doe" }),
        makeEmployee({ id: "emp-2", name: "Bob Smith" }),
      ]);

      const { findByText, getByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests from your team");
      await fireEvent.press(getByText("Swap Shifts"));

      expect(await findByText("Jane Doe → Bob Smith")).toBeTruthy();
      expect(await findByText("Approve")).toBeTruthy();
      expect(await findByText("Deny")).toBeTruthy();
    });

    it("manager approving a swap calls updateShiftSwap with 'manager_approve'", async () => {
      const swap = makeSwap({ status: "cover_accepted", coverId: "emp-2" });
      (getShiftSwaps as jest.Mock)
        .mockResolvedValueOnce([swap])
        .mockResolvedValueOnce([{ ...swap, status: "manager_approved" }]);
      (getShifts as jest.Mock).mockResolvedValue([makeShift()]);
      (updateShiftSwap as jest.Mock).mockResolvedValue(undefined);

      const { findByText, getByText } = await render(<RequestsScreen />);
      await findByText("No time-off requests from your team");
      await fireEvent.press(getByText("Swap Shifts"));
      await fireEvent.press(await findByText("Approve"));

      await waitFor(() =>
        expect(updateShiftSwap).toHaveBeenCalledWith("swap-1", "manager_approve")
      );
    });
  });
});
