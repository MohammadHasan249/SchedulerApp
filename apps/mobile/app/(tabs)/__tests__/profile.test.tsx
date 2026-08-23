import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import ProfileScreen from "../profile";
import { supabase } from "@/lib/supabase";
import { getOrganizationHours, unregisterPushToken } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import * as Notifications from "expo-notifications";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut: jest.fn() } },
}));

jest.mock("@/lib/api", () => ({
  getOrganizationHours: jest.fn(),
  unregisterPushToken: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  getExpoPushTokenAsync: jest.fn(),
}));

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function sessionWith(app_metadata: Record<string, unknown>, extra: Record<string, unknown> = {}): Session {
  return {
    user: { id: "auth-1", email: "jane@example.com", app_metadata, ...extra },
  } as unknown as Session;
}

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useAuthStore.setState({ session: null, employeeName: null });
    useMyEmployeeStore.getState().reset();
    (getOrganizationHours as jest.Mock).mockResolvedValue({});
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: "expo-token-1" });
    (supabase.auth.signOut as jest.Mock).mockResolvedValue(undefined);
  });

  it("shows the employee name and email once loaded", async () => {
    useAuthStore.setState({
      session: sessionWith({ role: "employee" }, { user_metadata: { full_name: "Jane Doe" } }),
    });

    const { findByText } = await render(<ProfileScreen />);

    expect(await findByText("Jane Doe")).toBeTruthy();
    expect(await findByText("jane@example.com")).toBeTruthy();
    expect(await findByText("Employee")).toBeTruthy();
  });

  it("shows the org hours for a non-admin once expanded", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
    (getOrganizationHours as jest.Mock).mockResolvedValue({
      "1": { startTime: "09:00", endTime: "17:00" },
    });

    const { findByText, getByText, findAllByText } = await render(<ProfileScreen />);
    await findByText("Organization Hours");

    await fireEvent.press(getByText("Organization Hours"));

    expect(await findByText("09:00 – 17:00")).toBeTruthy();
    expect((await findAllByText("Closed")).length).toBe(6);
  });

  it("does not show the expandable org-hours block for admins (only the settings link)", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });
    (getOrganizationHours as jest.Mock).mockResolvedValue({
      "1": { startTime: "09:00", endTime: "17:00" },
    });

    const { findByText, queryAllByText } = await render(<ProfileScreen />);
    await findByText("Manage");

    // "Organization Hours" appears once, as the admin settings link — the
    // read-only expandable block (with its own day rows) is employee-only.
    expect(queryAllByText("Organization Hours").length).toBe(1);
    expect(queryAllByText("Closed").length).toBe(0);
  });

  it("shows the full admin settings menu for org_admin", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });

    const { findByText } = await render(<ProfileScreen />);

    expect(await findByText("Attendance Reports")).toBeTruthy();
    expect(await findByText("Branches")).toBeTruthy();
    expect(await findByText("Job Roles")).toBeTruthy();
    expect(await findByText("Permissions")).toBeTruthy();
    expect(await findByText("Theme Colors")).toBeTruthy();
    expect(await findByText("Kiosk Exit PIN")).toBeTruthy();
  });

  it("hides Permissions for branch managers", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "branch_manager" }) });

    const { findByText, queryByText } = await render(<ProfileScreen />);
    await findByText("Manage");

    expect(queryByText("Permissions")).toBeNull();
  });

  it("navigates to a settings screen when a row is pressed", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "org_admin" }) });

    const { findByText, getByText } = await render(<ProfileScreen />);
    await findByText("Branches");

    await fireEvent.press(getByText("Branches"));

    expect(mockPush).toHaveBeenCalledWith("/(admin)/settings-branches");
  });

  it("signing out unregisters the push token and calls supabase signOut", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
    (unregisterPushToken as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByText } = await render(<ProfileScreen />);
    await findByText("Sign Out");
    await fireEvent.press(getByText("Sign Out"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Sign out",
      "Are you sure you want to sign out?",
      expect.any(Array)
    );

    const confirmBtn = alertButtons().find((b) => b.text === "Sign out");
    await act(async () => { await confirmBtn?.onPress?.(); });

    await waitFor(() => expect(unregisterPushToken).toHaveBeenCalledWith("expo-token-1"));
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("still signs out even if unregistering the push token fails", async () => {
    useAuthStore.setState({ session: sessionWith({ role: "employee" }) });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error("no push permission"));

    const { findByText, getByText } = await render(<ProfileScreen />);
    await findByText("Sign Out");
    await fireEvent.press(getByText("Sign Out"));

    const confirmBtn = alertButtons().find((b) => b.text === "Sign out");
    await act(async () => { await confirmBtn?.onPress?.(); });

    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled());
  });
});
