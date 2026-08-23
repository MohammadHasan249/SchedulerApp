import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ScheduleScreen from "../schedule";
import { getShifts, getEmployees, getJobRoles, assignEmployee, unassignEmployee } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import type { Employee, Shift } from "@scheduler/types";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/api", () => ({
  getShifts: jest.fn(),
  getEmployees: jest.fn(),
  getJobRoles: jest.fn(),
  assignEmployee: jest.fn(),
  unassignEmployee: jest.fn(),
}));

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: jest.fn(),
}));

function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "shift-1",
    branchId: "branch-1",
    startTime: todayAt(9),
    endTime: todayAt(17),
    isPublished: true,
    assignments: [],
    ...overrides,
  } as Shift;
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    organizationId: "org-1",
    branchId: "branch-1",
    authUserId: "auth-1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "employee",
    jobRoleId: null,
    maxHoursPerWeek: null,
    isActive: true,
    ...overrides,
  } as Employee;
}

function sessionWith(app_metadata: Record<string, unknown>, userId = "auth-1"): Session {
  return { user: { id: userId, app_metadata } } as unknown as Session;
}

describe("ScheduleScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useAuthStore.setState({ session: null, employeeName: null });
    useMyEmployeeStore.getState().reset();
    (getJobRoles as jest.Mock).mockResolvedValue([]);
  });

  describe("employee (non-admin)", () => {
    beforeEach(() => {
      useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
    });

    it("shows today's shifts once loaded", async () => {
      (getShifts as jest.Mock).mockResolvedValue([makeShift()]);
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);

      const { findByText } = await render(<ScheduleScreen />);

      expect(await findByText("9:00 AM")).toBeTruthy();
      expect(await findByText("8h shift")).toBeTruthy();
    });

    it("shows the empty state when there are no shifts today", async () => {
      (getShifts as jest.Mock).mockResolvedValue([]);
      (getEmployees as jest.Mock).mockResolvedValue([]);

      const { findByText } = await render(<ScheduleScreen />);

      expect(await findByText("No shifts scheduled")).toBeTruthy();
    });

    it("badges the employee's own shift as 'Your shift'", async () => {
      const shift = makeShift({
        assignments: [{ id: "a1", employeeId: "emp-1", employeeName: "Jane Doe", jobRoleId: null }],
      });
      (getShifts as jest.Mock).mockResolvedValue([shift]);
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);

      const { findByText } = await render(<ScheduleScreen />);

      expect(await findByText("Your shift")).toBeTruthy();
    });

    it("shows an alert when loading shifts fails", async () => {
      (getShifts as jest.Mock).mockRejectedValue(new Error("network down"));
      (getEmployees as jest.Mock).mockResolvedValue([]);

      await render(<ScheduleScreen />);

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith("Couldn't load shifts", "network down")
      );
    });

    it("does not show the admin view toggle or AI Assign button", async () => {
      (getShifts as jest.Mock).mockResolvedValue([]);
      (getEmployees as jest.Mock).mockResolvedValue([]);

      const { findByText, queryByText } = await render(<ScheduleScreen />);
      await findByText("No shifts scheduled");

      expect(queryByText("Availability")).toBeNull();
      expect(queryByText("AI Assign")).toBeNull();
    });
  });

  describe("admin", () => {
    beforeEach(() => {
      useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });
    });

    it("loads employees and job roles alongside shifts", async () => {
      (getShifts as jest.Mock).mockResolvedValue([]);
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);

      const { findByText } = await render(<ScheduleScreen />);
      await findByText("No shifts scheduled");

      expect(getEmployees).toHaveBeenCalled();
      expect(getJobRoles).toHaveBeenCalled();
    });

    it("switches to the Availability view and shows employee availability", async () => {
      (getShifts as jest.Mock).mockResolvedValue([]);
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ role: "employee" })]);

      const { findByText, getByText } = await render(<ScheduleScreen />);
      await findByText("No shifts scheduled");

      await fireEvent.press(getByText("Availability"));

      expect(await findByText("Jane Doe")).toBeTruthy();
    });

    it("opens the assignment modal and assigns an unassigned employee", async () => {
      const shift = makeShift({ assignments: [] });
      (getShifts as jest.Mock)
        .mockResolvedValueOnce([shift])
        .mockResolvedValueOnce([
          { ...shift, assignments: [{ id: "a1", employeeId: "emp-1", employeeName: "Jane Doe", jobRoleId: null }] },
        ]);
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ role: "employee" })]);
      (assignEmployee as jest.Mock).mockResolvedValue(undefined);

      const { findByText, getByText, getByLabelText } = await render(<ScheduleScreen />);
      await fireEvent.press(await findByText("8h shift"));

      await findByText("Add Employee");
      await fireEvent.press(getByLabelText("Add Jane Doe"));

      await waitFor(() => expect(assignEmployee).toHaveBeenCalledWith("shift-1", "emp-1"));
      await waitFor(() => expect(getShifts).toHaveBeenCalledTimes(2));
      expect(await findByText("Assigned (1)")).toBeTruthy();
    });

    it("unassigns an assigned employee from the modal", async () => {
      const assignedShift = makeShift({
        assignments: [{ id: "a1", employeeId: "emp-1", employeeName: "Jane Doe", jobRoleId: null }],
      });
      (getShifts as jest.Mock)
        .mockResolvedValueOnce([assignedShift])
        .mockResolvedValueOnce([{ ...assignedShift, assignments: [] }]);
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ role: "employee" })]);
      (unassignEmployee as jest.Mock).mockResolvedValue(undefined);

      const { findByText, getByLabelText } = await render(<ScheduleScreen />);
      await fireEvent.press(await findByText("8h shift"));

      await findByText("Assigned (1)");
      await fireEvent.press(getByLabelText("Remove Jane Doe"));

      await waitFor(() => expect(unassignEmployee).toHaveBeenCalledWith("shift-1", "a1"));
      expect(await findByText("No one assigned yet")).toBeTruthy();
    });

    it("shows an alert when assigning fails", async () => {
      const shift = makeShift({ assignments: [] });
      (getShifts as jest.Mock).mockResolvedValue([shift]);
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ role: "employee" })]);
      (assignEmployee as jest.Mock).mockRejectedValue(new Error("Employee already assigned"));

      const { findByText, getByLabelText } = await render(<ScheduleScreen />);
      await fireEvent.press(await findByText("8h shift"));
      await findByText("Add Employee");

      await fireEvent.press(getByLabelText("Add Jane Doe"));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith("Couldn't assign", "Employee already assigned")
      );
    });

    it("navigates to the AI assign screen", async () => {
      (getShifts as jest.Mock).mockResolvedValue([]);
      (getEmployees as jest.Mock).mockResolvedValue([]);

      const { findByText, getByText } = await render(<ScheduleScreen />);
      await findByText("No shifts scheduled");

      await fireEvent.press(getByText("AI Assign"));

      expect(mockPush).toHaveBeenCalledWith("/(admin)/schedule-ai");
    });
  });
});
