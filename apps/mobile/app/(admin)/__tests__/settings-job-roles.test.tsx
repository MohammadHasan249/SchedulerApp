import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import SettingsJobRolesScreen from "../settings-job-roles";
import { getJobRoles, createJobRole, updateJobRole, deleteJobRole } from "@/lib/api";
import type { JobRole } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getJobRoles: jest.fn(),
  createJobRole: jest.fn(),
  updateJobRole: jest.fn(),
  deleteJobRole: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

function makeRole(overrides: Partial<JobRole> = {}): JobRole {
  return { id: "role-1", organizationId: "org-1", name: "Cook", ...overrides } as JobRole;
}

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

describe("SettingsJobRolesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("shows the empty state", async () => {
    (getJobRoles as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<SettingsJobRolesScreen />);

    expect(await findByText("No job roles yet")).toBeTruthy();
  });

  it("renders job roles", async () => {
    (getJobRoles as jest.Mock).mockResolvedValue([makeRole({ name: "Server" })]);

    const { findByText } = await render(<SettingsJobRolesScreen />);

    expect(await findByText("Server")).toBeTruthy();
  });

  it("shows an alert when loading fails", async () => {
    (getJobRoles as jest.Mock).mockRejectedValue(new Error("network down"));

    await render(<SettingsJobRolesScreen />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Couldn't load job roles", "network down")
    );
  });

  it("creates a new role via the fab", async () => {
    (getJobRoles as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([makeRole({ name: "Cashier" })]);
    (createJobRole as jest.Mock).mockResolvedValue(makeRole({ name: "Cashier" }));

    const { findByText, getByText, getByPlaceholderText, getByLabelText } = await render(
      <SettingsJobRolesScreen />
    );
    await findByText("No job roles yet");

    await fireEvent.press(getByLabelText("Add job role"));
    await fireEvent.changeText(getByPlaceholderText("e.g. Cook, Server, Cashier"), "Cashier");
    await fireEvent.press(getByText("Create"));

    await waitFor(() => expect(createJobRole).toHaveBeenCalledWith("Cashier"));
    expect(await findByText("Cashier")).toBeTruthy();
  });

  it("requires a name before saving", async () => {
    (getJobRoles as jest.Mock).mockResolvedValue([]);

    const { findByText, getByText, getByLabelText } = await render(<SettingsJobRolesScreen />);
    await findByText("No job roles yet");

    await fireEvent.press(getByLabelText("Add job role"));
    await fireEvent.press(getByText("Create"));

    expect(await findByText("Name is required.")).toBeTruthy();
    expect(createJobRole).not.toHaveBeenCalled();
  });

  it("edits an existing role", async () => {
    (getJobRoles as jest.Mock)
      .mockResolvedValueOnce([makeRole()])
      .mockResolvedValueOnce([makeRole({ name: "Head Cook" })]);
    (updateJobRole as jest.Mock).mockResolvedValue(makeRole({ name: "Head Cook" }));

    const { findByText, getByLabelText, getByPlaceholderText, getByText } = await render(
      <SettingsJobRolesScreen />
    );
    await findByText("Cook");

    await fireEvent.press(getByLabelText("Edit Cook"));
    await fireEvent.changeText(getByPlaceholderText("e.g. Cook, Server, Cashier"), "Head Cook");
    await fireEvent.press(getByText("Save"));

    await waitFor(() => expect(updateJobRole).toHaveBeenCalledWith("role-1", "Head Cook"));
    expect(await findByText("Head Cook")).toBeTruthy();
  });

  it("deletes a role after confirming", async () => {
    (getJobRoles as jest.Mock).mockResolvedValueOnce([makeRole()]).mockResolvedValueOnce([]);
    (deleteJobRole as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByLabelText, queryByText } = await render(<SettingsJobRolesScreen />);
    await findByText("Cook");

    await fireEvent.press(getByLabelText("Delete Cook"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Delete job role?",
      'Remove "Cook"? Employees and shifts referencing it will be unset.',
      expect.any(Array)
    );
    const confirmBtn = alertButtons().find((b) => b.text === "Delete");
    await act(async () => {
      await confirmBtn?.onPress?.();
    });

    await waitFor(() => expect(deleteJobRole).toHaveBeenCalledWith("role-1"));
    await waitFor(() => expect(queryByText("Cook")).toBeNull());
  });

  it("shows an error message when deleting fails", async () => {
    (getJobRoles as jest.Mock).mockResolvedValue([makeRole()]);
    (deleteJobRole as jest.Mock).mockRejectedValue(new Error("in use"));

    const { findByText, getByLabelText } = await render(<SettingsJobRolesScreen />);
    await findByText("Cook");

    await fireEvent.press(getByLabelText("Delete Cook"));
    const confirmBtn = alertButtons().find((b) => b.text === "Delete");
    await act(async () => {
      await confirmBtn?.onPress?.();
    });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Error", "in use"));
  });
});
