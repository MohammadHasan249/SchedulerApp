import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import EmployeeDetailScreen from "../[id]";
import {
  getEmployee,
  getBranches,
  getJobRoles,
  updateEmployee,
  deleteEmployee,
  getMyPermissions,
  getPayRates,
} from "@/lib/api";
import type { Employee, Branch, JobRole } from "@scheduler/types";

jest.mock("@/lib/api", () => ({
  getEmployee: jest.fn(),
  getBranches: jest.fn(),
  getJobRoles: jest.fn(),
  updateEmployee: jest.fn(),
  deleteEmployee: jest.fn(),
  getMyPermissions: jest.fn(),
  getPayRates: jest.fn(),
  createPayRate: jest.fn(),
}));

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "emp-1" }),
  useRouter: () => ({ back: mockBack }),
  Stack: { Screen: () => null },
}));

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    organizationId: "org-1",
    branchId: null,
    authUserId: null,
    name: "Jane Doe",
    email: "jane@example.com",
    role: "employee",
    jobRoleId: null,
    maxHoursPerWeek: 40,
    isActive: true,
    ...overrides,
  } as Employee;
}

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return { id: "branch-1", slug: "main", name: "Main Branch", ...overrides } as Branch;
}

function makeJobRole(overrides: Partial<JobRole> = {}): JobRole {
  return { id: "role-1", organizationId: "org-1", name: "Cook", ...overrides } as JobRole;
}

describe("EmployeeDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getBranches as jest.Mock).mockResolvedValue([makeBranch()]);
    (getJobRoles as jest.Mock).mockResolvedValue([makeJobRole()]);
    (getMyPermissions as jest.Mock).mockResolvedValue([]);
    (getPayRates as jest.Mock).mockResolvedValue([]);
  });

  it("renders employee details once loaded", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(
      makeEmployee({ branchId: "branch-1", jobRoleId: "role-1", maxHoursPerWeek: 35 })
    );

    const { findByText } = await render(<EmployeeDetailScreen />);

    expect(await findByText("Jane Doe")).toBeTruthy();
    expect(await findByText("jane@example.com")).toBeTruthy();
    expect(await findByText("Active")).toBeTruthy();
    expect(await findByText("Employee")).toBeTruthy();
    expect(await findByText("Main Branch")).toBeTruthy();
    expect(await findByText("Cook")).toBeTruthy();
    expect(await findByText("35")).toBeTruthy();
  });

  it("shows an alert when loading fails", async () => {
    (getEmployee as jest.Mock).mockRejectedValue(new Error("network down"));

    await render(<EmployeeDetailScreen />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Couldn't load employee", "network down")
    );
  });

  it("shows 'Employee not found.' when the API returns nothing", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(null);

    const { findByText } = await render(<EmployeeDetailScreen />);

    expect(await findByText("Employee not found.")).toBeTruthy();
  });

  it("hides compensation when the viewer lacks salaries:view", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(makeEmployee());
    (getMyPermissions as jest.Mock).mockResolvedValue([]);

    const { findByText, queryByText } = await render(<EmployeeDetailScreen />);
    await findByText("Jane Doe");

    expect(queryByText("Compensation")).toBeNull();
  });

  it("shows read-only compensation when the viewer has salaries:view but not salaries:edit", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(makeEmployee());
    (getMyPermissions as jest.Mock).mockResolvedValue(["salaries:view"]);

    const { findByText, queryByText } = await render(<EmployeeDetailScreen />);

    expect(await findByText("Compensation")).toBeTruthy();
    expect(queryByText("Add rate")).toBeNull();
  });

  it("shows editable compensation when the viewer has salaries:edit", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(makeEmployee());
    (getMyPermissions as jest.Mock).mockResolvedValue(["salaries:view", "salaries:edit"]);

    const { findByText } = await render(<EmployeeDetailScreen />);

    expect(await findByText("Add rate")).toBeTruthy();
  });

  it("deactivates an active employee", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(makeEmployee({ isActive: true }));
    (deleteEmployee as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByText } = await render(<EmployeeDetailScreen />);
    await findByText("Deactivate");

    await fireEvent.press(getByText("Deactivate"));

    await waitFor(() => expect(deleteEmployee).toHaveBeenCalledWith("emp-1"));
    expect(await findByText("Inactive")).toBeTruthy();
    expect(await findByText("Reactivate")).toBeTruthy();
  });

  it("reactivates an inactive employee", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(makeEmployee({ isActive: false }));
    (updateEmployee as jest.Mock).mockResolvedValue(makeEmployee({ isActive: true }));

    const { findByText, getByText } = await render(<EmployeeDetailScreen />);
    await findByText("Reactivate");

    await fireEvent.press(getByText("Reactivate"));

    await waitFor(() =>
      expect(updateEmployee).toHaveBeenCalledWith("emp-1", { isActive: true })
    );
    expect(await findByText("Active")).toBeTruthy();
  });

  it("shows an error alert when toggling active state fails", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(makeEmployee({ isActive: true }));
    (deleteEmployee as jest.Mock).mockRejectedValue(new Error("Cannot deactivate self"));

    const { findByText, getByText } = await render(<EmployeeDetailScreen />);
    await findByText("Deactivate");

    await fireEvent.press(getByText("Deactivate"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Cannot deactivate self")
    );
  });

  it("navigates back when the back link is pressed", async () => {
    (getEmployee as jest.Mock).mockResolvedValue(makeEmployee());

    const { findByText, getByText } = await render(<EmployeeDetailScreen />);
    await findByText("Jane Doe");

    await fireEvent.press(getByText("← Back to employees"));

    expect(mockBack).toHaveBeenCalled();
  });
});
