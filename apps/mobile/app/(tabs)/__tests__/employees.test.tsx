import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import EmployeesScreen from "../employees";
import {
  getEmployees,
  inviteEmployee,
  updateEmployee,
  getBranches,
  getJobRoles,
} from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import type { Employee, Branch, JobRole } from "@scheduler/types";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/api", () => ({
  getEmployees: jest.fn(),
  inviteEmployee: jest.fn(),
  updateEmployee: jest.fn(),
  getBranches: jest.fn(),
  getJobRoles: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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
  return { id: "role-1", organizationId: "org-1", name: "Cashier", ...overrides } as JobRole;
}

function sessionWith(app_metadata: Record<string, unknown>): Session {
  return { user: { id: "auth-1", app_metadata } } as unknown as Session;
}

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

describe("EmployeesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });
    (getBranches as jest.Mock).mockResolvedValue([makeBranch()]);
    (getJobRoles as jest.Mock).mockResolvedValue([makeJobRole()]);
  });

  it("redirects a non-admin employee to the schedule screen instead of rendering the list", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
    (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);

    const { queryByText } = await render(<EmployeesScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)/schedule"));
    expect(queryByText("Jane Doe")).toBeNull();
  });

  it("shows the empty state when there are no employees", async () => {
    (getEmployees as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<EmployeesScreen />);

    expect(await findByText("No employees yet.")).toBeTruthy();
  });

  it("renders employee cards with role, branch, and job role tags", async () => {
    (getEmployees as jest.Mock).mockResolvedValue([
      makeEmployee({ branchId: "branch-1", jobRoleId: "role-1" }),
    ]);

    const { findByText } = await render(<EmployeesScreen />);

    expect(await findByText("Jane Doe")).toBeTruthy();
    expect(await findByText("jane@example.com")).toBeTruthy();
    expect(await findByText("Employee")).toBeTruthy();
    expect(await findByText("Main Branch")).toBeTruthy();
    expect(await findByText("Cashier")).toBeTruthy();
  });

  it("shows an 'Inactive' tag for deactivated employees", async () => {
    (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ isActive: false })]);

    const { findByText, getByText } = await render(<EmployeesScreen />);

    // Inactive employees are hidden until the "Active only" filter is toggled off.
    await findByText("No active employees.");
    await fireEvent.press(getByText("Active only"));

    expect(await findByText("Inactive")).toBeTruthy();
  });

  it("shows an alert when loading fails", async () => {
    (getEmployees as jest.Mock).mockRejectedValue(new Error("network down"));

    await render(<EmployeesScreen />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Couldn't load employees", "network down")
    );
  });

  it("navigates to the employee detail screen when a card is pressed", async () => {
    (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);

    const { findByText } = await render(<EmployeesScreen />);
    await fireEvent.press(await findByText("Jane Doe"));

    expect(mockPush).toHaveBeenCalledWith("/(admin)/employees/emp-1");
  });

  describe("invite flow", () => {
    beforeEach(() => {
      (getEmployees as jest.Mock).mockResolvedValue([]);
    });

    it("validates required fields before calling the API", async () => {
      const { findByText, getByText } = await render(<EmployeesScreen />);
      await findByText("No employees yet.");

      await fireEvent.press(getByText("Invite Employee"));
      await fireEvent.press(getByText("Send Invitation"));

      expect(await findByText("Name is required.")).toBeTruthy();
      expect(inviteEmployee).not.toHaveBeenCalled();
    });

    it("validates the email format", async () => {
      const { findByText, getByText, getByPlaceholderText } = await render(<EmployeesScreen />);
      await findByText("No employees yet.");

      await fireEvent.press(getByText("Invite Employee"));
      await fireEvent.changeText(getByPlaceholderText("Full name"), "New Person");
      await fireEvent.changeText(getByPlaceholderText("email@example.com"), "not-an-email");
      await fireEvent.press(getByText("Send Invitation"));

      expect(await findByText("Enter a valid email.")).toBeTruthy();
      expect(inviteEmployee).not.toHaveBeenCalled();
    });

    it("validates the kiosk PIN format", async () => {
      const { findByText, getByText, getByPlaceholderText } = await render(<EmployeesScreen />);
      await findByText("No employees yet.");

      await fireEvent.press(getByText("Invite Employee"));
      await fireEvent.changeText(getByPlaceholderText("Full name"), "New Person");
      await fireEvent.changeText(getByPlaceholderText("email@example.com"), "new@example.com");
      await fireEvent.changeText(getByPlaceholderText("Leave blank to skip"), "12");
      await fireEvent.press(getByText("Send Invitation"));

      expect(await findByText("PIN must be 4–6 digits.")).toBeTruthy();
      expect(inviteEmployee).not.toHaveBeenCalled();
    });

    it("submits a valid invite and shows the email-sent confirmation", async () => {
      (inviteEmployee as jest.Mock).mockResolvedValue({ emailSent: true });

      const { findByText, getByText, getByPlaceholderText, queryByText } = await render(
        <EmployeesScreen />
      );
      await findByText("No employees yet.");

      await fireEvent.press(getByText("Invite Employee"));
      await fireEvent.changeText(getByPlaceholderText("Full name"), "New Person");
      await fireEvent.changeText(getByPlaceholderText("email@example.com"), "New@Example.com");
      await fireEvent.press(getByText("Send Invitation"));

      await waitFor(() =>
        expect(inviteEmployee).toHaveBeenCalledWith({
          name: "New Person",
          email: "new@example.com",
          role: "employee",
          branchId: "branch-1",
          maxHoursPerWeek: 40,
        })
      );

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          "Invited",
          "An invitation email has been sent to New@Example.com."
        )
      );
      await waitFor(() => expect(queryByText("Invite Employee", { exact: true })).toBeTruthy());
      expect(getEmployees).toHaveBeenCalledTimes(2);
    });

    it("shows the fallback message when the invite email could not be sent", async () => {
      (inviteEmployee as jest.Mock).mockResolvedValue({ emailSent: false });

      const { findByText, getByText, getByPlaceholderText } = await render(<EmployeesScreen />);
      await findByText("No employees yet.");

      await fireEvent.press(getByText("Invite Employee"));
      await fireEvent.changeText(getByPlaceholderText("Full name"), "New Person");
      await fireEvent.changeText(getByPlaceholderText("email@example.com"), "new@example.com");
      await fireEvent.press(getByText("Send Invitation"));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          "Invited",
          "New Person was added, but the invitation email couldn't be sent. Share the signup link manually."
        )
      );
    });

    it("shows a server error message and keeps the modal open on failure", async () => {
      (inviteEmployee as jest.Mock).mockRejectedValue(new Error("Email already invited"));

      const { findByText, getByText, getByPlaceholderText } = await render(<EmployeesScreen />);
      await findByText("No employees yet.");

      await fireEvent.press(getByText("Invite Employee"));
      await fireEvent.changeText(getByPlaceholderText("Full name"), "New Person");
      await fireEvent.changeText(getByPlaceholderText("email@example.com"), "new@example.com");
      await fireEvent.press(getByText("Send Invitation"));

      expect(await findByText("Email already invited")).toBeTruthy();
    });
  });

  describe("edit flow", () => {
    it("opens the edit modal without navigating to the detail screen", async () => {
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);

      const { findByText, getByLabelText } = await render(<EmployeesScreen />);
      await findByText("Jane Doe");

      await fireEvent.press(getByLabelText("Edit Jane Doe"));

      expect(await findByText("Save Changes")).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("validates max hours before saving", async () => {
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);

      const { findByText, getByLabelText, getByPlaceholderText, getByText } = await render(
        <EmployeesScreen />
      );
      await findByText("Jane Doe");
      await fireEvent.press(getByLabelText("Edit Jane Doe"));
      await findByText("Save Changes");

      await fireEvent.changeText(getByPlaceholderText("40"), "0");
      await fireEvent.press(getByText("Save Changes"));

      expect(await findByText("Max hours must be 1–168.")).toBeTruthy();
      expect(updateEmployee).not.toHaveBeenCalled();
    });

    it("saves valid changes and reloads the list", async () => {
      (getEmployees as jest.Mock).mockResolvedValue([
        makeEmployee({ branchId: "branch-1", jobRoleId: "role-1" }),
      ]);
      (updateEmployee as jest.Mock).mockResolvedValue(undefined);

      const { findByText, getByLabelText, getByPlaceholderText, getByText, queryByText } =
        await render(<EmployeesScreen />);
      await findByText("Jane Doe");
      await fireEvent.press(getByLabelText("Edit Jane Doe"));
      await findByText("Save Changes");

      await fireEvent.changeText(getByPlaceholderText("40"), "35");
      await fireEvent.press(getByText("Save Changes"));

      await waitFor(() =>
        expect(updateEmployee).toHaveBeenCalledWith("emp-1", {
          branchId: "branch-1",
          jobRoleId: "role-1",
          maxHoursPerWeek: 35,
        })
      );
      await waitFor(() => expect(queryByText("Save Changes")).toBeNull());
      expect(getEmployees).toHaveBeenCalledTimes(2);
    });
  });

  describe("deactivate / activate flow", () => {
    it("deactivating an active employee confirms, then calls the API and reloads", async () => {
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ isActive: true })]);
      (updateEmployee as jest.Mock).mockResolvedValue(undefined);

      const { findByText, getByLabelText, getByText } = await render(<EmployeesScreen />);
      await findByText("Jane Doe");
      await fireEvent.press(getByLabelText("Edit Jane Doe"));
      await findByText("Deactivate Employee");

      await fireEvent.press(getByText("Deactivate Employee"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Deactivate Jane Doe?",
        "They will no longer be able to log in.",
        expect.any(Array)
      );

      const confirmBtn = alertButtons().find((b) => b.text === "Deactivate");
      await act(async () => { await confirmBtn?.onPress?.(); });

      await waitFor(() =>
        expect(updateEmployee).toHaveBeenCalledWith("emp-1", { isActive: false })
      );
      expect(getEmployees).toHaveBeenCalledTimes(2);
    });

    it("shows an alert when deactivation fails", async () => {
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ isActive: true })]);
      (updateEmployee as jest.Mock).mockRejectedValue(new Error("Cannot deactivate self"));

      const { findByText, getByLabelText, getByText } = await render(<EmployeesScreen />);
      await findByText("Jane Doe");
      await fireEvent.press(getByLabelText("Edit Jane Doe"));
      await findByText("Deactivate Employee");
      await fireEvent.press(getByText("Deactivate Employee"));

      const confirmBtn = alertButtons().find((b) => b.text === "Deactivate");
      await act(async () => { await confirmBtn?.onPress?.(); });

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith("Couldn't deactivate employee", "Cannot deactivate self")
      );
    });

    it("offers 'Activate' for an inactive employee", async () => {
      (getEmployees as jest.Mock).mockResolvedValue([makeEmployee({ isActive: false })]);

      const { findByText, getByLabelText, getByText } = await render(<EmployeesScreen />);
      // Inactive employees are hidden until the "Active only" filter is toggled off.
      await findByText("No active employees.");
      await fireEvent.press(getByText("Active only"));
      await findByText("Jane Doe");
      await fireEvent.press(getByLabelText("Edit Jane Doe"));
      await findByText("Activate Employee");
      await fireEvent.press(getByText("Activate Employee"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Activate Jane Doe?",
        "They will regain access.",
        expect.any(Array)
      );
    });
  });
});
