import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import DashboardScreen from "../dashboard";
import { getDashboardStats } from "@/lib/api";
import type { DashboardStats } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/api", () => ({
  getDashboardStats: jest.fn(),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

function adminSession(): Session {
  return { user: { id: "auth-1", app_metadata: { role: "org_admin" } } } as unknown as Session;
}

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    clockedInCount: 3,
    totalShiftsToday: 5,
    pendingTimeOffCount: 1,
    todayShifts: [],
    ...overrides,
  };
}

describe("DashboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useAuthStore.setState({ session: adminSession(), employeeName: null });
  });

  it("redirects non-admins to the schedule screen instead of rendering stats", async () => {
    useAuthStore.setState({
      session: { user: { id: "auth-2", app_metadata: { role: "employee" } } } as unknown as Session,
      employeeName: null,
    });
    (getDashboardStats as jest.Mock).mockResolvedValue(makeStats());

    const { queryByText } = await render(<DashboardScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)/schedule"));
    expect(queryByText("Clocked In")).toBeNull();
  });

  it("renders stats once loaded", async () => {
    (getDashboardStats as jest.Mock).mockResolvedValue(makeStats());

    const { findByText } = await render(<DashboardScreen />);

    expect(await findByText("3")).toBeTruthy();
    expect(await findByText("Clocked In")).toBeTruthy();
    expect(await findByText("5")).toBeTruthy();
    expect(await findByText("Shifts Today")).toBeTruthy();
    expect(await findByText("1")).toBeTruthy();
    expect(await findByText("Pending Time Off")).toBeTruthy();
  });

  it("shows today's shifts with employee names and times", async () => {
    (getDashboardStats as jest.Mock).mockResolvedValue(
      makeStats({
        todayShifts: [
          { id: "s1", startTime: "2026-01-01T09:00:00.000Z", endTime: "2026-01-01T17:00:00.000Z", employeeName: "Jane Doe", timezone: "America/New_York" },
        ],
      })
    );

    const { findByText } = await render(<DashboardScreen />);

    expect(await findByText("Jane Doe")).toBeTruthy();
  });

  it("shows 'Unassigned' for a shift with no employee", async () => {
    (getDashboardStats as jest.Mock).mockResolvedValue(
      makeStats({
        todayShifts: [
          { id: "s1", startTime: "2026-01-01T09:00:00.000Z", endTime: "2026-01-01T17:00:00.000Z", employeeName: null, timezone: "America/New_York" },
        ],
      })
    );

    const { findByText } = await render(<DashboardScreen />);

    expect(await findByText("Unassigned")).toBeTruthy();
  });

  it("shows the empty state when there are no shifts today", async () => {
    (getDashboardStats as jest.Mock).mockResolvedValue(makeStats({ todayShifts: [] }));

    const { findByText } = await render(<DashboardScreen />);

    expect(await findByText("No shifts scheduled today.")).toBeTruthy();
  });

  it("shows an alert and an inline error state when loading fails", async () => {
    (getDashboardStats as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText } = await render(<DashboardScreen />);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Couldn't load dashboard", "network down")
    );
    expect(await findByText("network down")).toBeTruthy();
  });

  it("navigates to the kiosk clock-in screen", async () => {
    (getDashboardStats as jest.Mock).mockResolvedValue(makeStats());

    const { findByText, getByText } = await render(<DashboardScreen />);
    await findByText("Kiosk Clock-In");

    await fireEvent.press(getByText("Kiosk Clock-In"));

    expect(mockPush).toHaveBeenCalledWith("/(tabs)/clock-in");
  });
});
