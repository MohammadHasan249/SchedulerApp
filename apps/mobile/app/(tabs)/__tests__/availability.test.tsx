import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AvailabilityScreen from "../availability";
import { getAvailability, saveAvailability, getOrganizationHours } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import type { Employee } from "@scheduler/types";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/api", () => ({
  getAvailability: jest.fn(),
  saveAvailability: jest.fn(),
  getOrganizationHours: jest.fn(),
}));

jest.mock("@/lib/myEmployeeStore", () => ({
  useMyEmployeeStore: jest.fn(),
}));

function sessionWith(userId = "auth-1"): Session {
  return { user: { id: userId, app_metadata: {} } } as unknown as Session;
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

describe("AvailabilityScreen", () => {
  const fetchMyEmployee = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useAuthStore.setState({ session: sessionWith() });
    (useMyEmployeeStore as unknown as jest.Mock).mockReturnValue({ fetchMyEmployee });
    (getOrganizationHours as jest.Mock).mockResolvedValue({});
  });

  it("shows an alert and stops loading when the account has no linked employee", async () => {
    fetchMyEmployee.mockResolvedValue(null);

    const { findByText } = await render(<AvailabilityScreen />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "No employee profile",
        "Your account isn't linked to an employee record. Ask your manager to re-invite you."
      )
    );
    expect(await findByText("Sunday")).toBeTruthy();
  });

  it("defaults each day to the org's hours when nothing is saved yet", async () => {
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getOrganizationHours as jest.Mock).mockResolvedValue({
      "1": { startTime: "09:00", endTime: "17:00" },
    });
    (getAvailability as jest.Mock).mockResolvedValue({});

    const { findAllByText } = await render(<AvailabilityScreen />);

    expect((await findAllByText("09:00")).length).toBeGreaterThan(0);
    expect((await findAllByText("17:00")).length).toBeGreaterThan(0);
  });

  it("marks a day unavailable when the org is closed and nothing is saved", async () => {
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getOrganizationHours as jest.Mock).mockResolvedValue({});
    (getAvailability as jest.Mock).mockResolvedValue({});

    const { findAllByText } = await render(<AvailabilityScreen />);

    expect((await findAllByText("Unavailable")).length).toBe(7);
  });

  it("uses the employee's saved availability over the org default", async () => {
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getOrganizationHours as jest.Mock).mockResolvedValue({
      "1": { startTime: "09:00", endTime: "17:00" },
    });
    (getAvailability as jest.Mock).mockResolvedValue({
      1: { startTime: "10:00:00", endTime: "18:00:00" },
    });

    const { findAllByText } = await render(<AvailabilityScreen />);

    expect((await findAllByText("10:00")).length).toBeGreaterThan(0);
    expect((await findAllByText("18:00")).length).toBeGreaterThan(0);
  });

  it("toggling a day off shows one more 'Unavailable' day", async () => {
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getAvailability as jest.Mock).mockResolvedValue({
      1: { startTime: "09:00:00", endTime: "17:00:00" },
    });

    const { findByText, findAllByText, getByText } = await render(<AvailabilityScreen />);
    await findByText("Monday");
    const before = (await findAllByText("Unavailable")).length;

    await fireEvent.press(getByText("Monday"));

    await waitFor(async () => {
      expect((await findAllByText("Unavailable")).length).toBe(before + 1);
    });
  });

  it("rejects a start time that isn't before the end time", async () => {
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getAvailability as jest.Mock).mockResolvedValue({
      1: { startTime: "18:00:00", endTime: "17:00:00" },
    });

    const { findByText, getByText } = await render(<AvailabilityScreen />);
    await findByText("Save Availability");

    await fireEvent.press(getByText("Save Availability"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Invalid times",
        "Monday: start time must be before end time."
      )
    );
    expect(saveAvailability).not.toHaveBeenCalled();
  });

  it("saves enabled days and shows a confirmation", async () => {
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getAvailability as jest.Mock).mockResolvedValue({
      1: { startTime: "09:00:00", endTime: "17:00:00" },
    });
    (saveAvailability as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByText } = await render(<AvailabilityScreen />);
    await findByText("Save Availability");

    await fireEvent.press(getByText("Save Availability"));

    await waitFor(() => expect(saveAvailability).toHaveBeenCalledWith("emp-1", expect.any(Object)));
    const payload = (saveAvailability as jest.Mock).mock.calls[0][1];
    expect(payload[1]).toEqual({ startTime: "09:00", endTime: "17:00" });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Saved", "Your availability has been updated.")
    );
  });

  it("shows an error alert when saving fails", async () => {
    fetchMyEmployee.mockResolvedValue(makeEmployee());
    (getAvailability as jest.Mock).mockResolvedValue({
      1: { startTime: "09:00:00", endTime: "17:00:00" },
    });
    (saveAvailability as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText, getByText } = await render(<AvailabilityScreen />);
    await findByText("Save Availability");

    await fireEvent.press(getByText("Save Availability"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Error", "network down"));
  });
});
