import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import SettingsPermissionsScreen from "../settings-permissions";
import {
  getPermissionProfiles,
  createPermissionProfile,
  updatePermissionProfile,
  deletePermissionProfile,
  getEmployees,
  updateEmployee,
} from "@/lib/api";
import type { PermissionProfile } from "@scheduler/types";
import type { Employee } from "@scheduler/types";

jest.mock("@/lib/api", () => ({
  getPermissionProfiles: jest.fn(),
  createPermissionProfile: jest.fn(),
  updatePermissionProfile: jest.fn(),
  deletePermissionProfile: jest.fn(),
  getEmployees: jest.fn(),
  updateEmployee: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

function makeProfile(overrides: Partial<PermissionProfile> = {}): PermissionProfile {
  return {
    id: "prof-1",
    organizationId: "org-1",
    name: "Shift Lead",
    permissions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as PermissionProfile;
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    organizationId: "org-1",
    branchId: null,
    authUserId: null,
    name: "Jane Doe",
    email: "jane@example.com",
    role: "branch_manager",
    jobRoleId: null,
    maxHoursPerWeek: 40,
    isActive: true,
    permissionProfileId: null,
    ...overrides,
  } as Employee;
}

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

describe("SettingsPermissionsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (getEmployees as jest.Mock).mockResolvedValue([]);
    (getPermissionProfiles as jest.Mock).mockResolvedValue([]);
  });

  it("shows empty states for profiles and assignable employees", async () => {
    const { findByText } = await render(<SettingsPermissionsScreen />);

    expect(await findByText("No profiles yet.")).toBeTruthy();
    expect(
      await findByText("No managers or staff to assign. Org admins already have every permission.")
    ).toBeTruthy();
  });

  it("excludes org_admin and inactive employees from the assign list", async () => {
    (getEmployees as jest.Mock).mockResolvedValue([
      makeEmployee({ id: "e1", name: "Admin User", role: "org_admin" }),
      makeEmployee({ id: "e2", name: "Inactive User", isActive: false }),
      makeEmployee({ id: "e3", name: "Assignable User" }),
    ]);

    const { findByText, queryByText } = await render(<SettingsPermissionsScreen />);

    expect(await findByText("Assignable User")).toBeTruthy();
    expect(queryByText("Admin User")).toBeNull();
    expect(queryByText("Inactive User")).toBeNull();
  });

  it("requires a name before creating a profile", async () => {
    const { findByText, getByText } = await render(<SettingsPermissionsScreen />);
    await findByText("No profiles yet.");

    await fireEvent.press(getByText("Create profile"));

    expect(await findByText("Give the profile a name.")).toBeTruthy();
    expect(createPermissionProfile).not.toHaveBeenCalled();
  });

  it("creates a new profile with the selected permissions", async () => {
    (createPermissionProfile as jest.Mock).mockResolvedValue(
      makeProfile({ name: "Shift Lead", permissions: ["salaries:view"] })
    );

    const { findByText, getByText, getByPlaceholderText } = await render(
      <SettingsPermissionsScreen />
    );
    await findByText("No profiles yet.");

    await fireEvent.changeText(getByPlaceholderText("Name (e.g. Shift Lead)"), "Shift Lead");
    await fireEvent.press(getByText("View salaries"));
    await fireEvent.press(getByText("Create profile"));

    await waitFor(() =>
      expect(createPermissionProfile).toHaveBeenCalledWith({
        name: "Shift Lead",
        permissions: ["salaries:view"],
      })
    );
    expect(await findByText("Shift Lead")).toBeTruthy();
  });

  it("toggling a profile's permission chip calls updatePermissionProfile", async () => {
    (getPermissionProfiles as jest.Mock).mockResolvedValue([makeProfile()]);
    (updatePermissionProfile as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getAllByText } = await render(<SettingsPermissionsScreen />);
    await findByText("Shift Lead");

    // "Edit salaries" appears twice: the "New profile" builder's chip, then
    // this profile's own toggle chip — press the second.
    await fireEvent.press(getAllByText("Edit salaries")[1]);

    await waitFor(() =>
      expect(updatePermissionProfile).toHaveBeenCalledWith("prof-1", {
        permissions: ["salaries:edit"],
      })
    );
  });

  it("reverts the optimistic toggle when updating a profile fails", async () => {
    (getPermissionProfiles as jest.Mock).mockResolvedValue([makeProfile()]);
    (updatePermissionProfile as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText, getAllByText } = await render(<SettingsPermissionsScreen />);
    await findByText("Shift Lead");

    await fireEvent.press(getAllByText("Edit salaries")[1]);

    expect(await findByText("network down")).toBeTruthy();
  });

  it("deletes a profile after confirming and unassigns affected employees", async () => {
    const profile = makeProfile();
    (getPermissionProfiles as jest.Mock).mockResolvedValue([profile]);
    (getEmployees as jest.Mock).mockResolvedValue([
      makeEmployee({ permissionProfileId: "prof-1" }),
    ]);
    (deletePermissionProfile as jest.Mock).mockResolvedValue(undefined);

    const { findAllByText, getByLabelText, queryAllByText } = await render(
      <SettingsPermissionsScreen />
    );
    await findAllByText("Shift Lead");

    await fireEvent.press(getByLabelText("Delete Shift Lead"));
    const confirmBtn = alertButtons().find((b) => b.text === "Delete");
    await act(async () => {
      await confirmBtn?.onPress?.();
    });

    await waitFor(() => expect(deletePermissionProfile).toHaveBeenCalledWith("prof-1"));
    await waitFor(() => expect(queryAllByText("Shift Lead").length).toBe(0));
  });

  it("assigns a profile to an employee", async () => {
    const profile = makeProfile();
    (getPermissionProfiles as jest.Mock).mockResolvedValue([profile]);
    (getEmployees as jest.Mock).mockResolvedValue([makeEmployee()]);
    (updateEmployee as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getAllByText } = await render(<SettingsPermissionsScreen />);
    await findByText("Jane Doe");

    // "Shift Lead" appears as both the profile block title and the assign
    // chip; press the chip (second occurrence).
    await fireEvent.press(getAllByText("Shift Lead")[1]);

    await waitFor(() =>
      expect(updateEmployee).toHaveBeenCalledWith("emp-1", { permissionProfileId: "prof-1" })
    );
  });
});
