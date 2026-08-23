import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ClockInScreen from "../clock-in";
import { clockPunch, verifyExitPin, getBranches } from "@/lib/api";
import { useKioskStore } from "@/lib/kioskStore";
import { useAuthStore } from "@/lib/authStore";
import type { Branch } from "@/lib/api";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/api", () => ({
  clockPunch: jest.fn(),
  verifyExitPin: jest.fn(),
  getBranches: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useNavigation: () => ({ addListener: mockAddListener }),
}));

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return { id: "branch-1", slug: "main", name: "Main Branch", ...overrides } as Branch;
}

function adminSession(): Session {
  return { user: { id: "auth-1", app_metadata: { role: "org_admin" } } } as unknown as Session;
}

async function enterPin(getByText: Awaited<ReturnType<typeof render>>["getByText"], pin: string) {
  for (const digit of pin) {
    await fireEvent.press(getByText(digit));
  }
}

describe("ClockInScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useKioskStore.setState({ isLocked: false, branchSlug: null });
    useAuthStore.setState({ session: adminSession(), employeeName: null });
    (getBranches as jest.Mock).mockResolvedValue([makeBranch()]);
  });

  it("redirects non-admins to the schedule screen", async () => {
    useAuthStore.setState({ session: null, employeeName: null });

    await render(<ClockInScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)/schedule"));
  });

  it("prompts for a PIN and shows the branch label", async () => {
    const { findByText } = await render(<ClockInScreen />);

    expect(await findByText("Enter your PIN")).toBeTruthy();
    expect(await findByText("Branch: not set")).toBeTruthy();
  });

  it("opens the branch modal instead of punching when no branch is set", async () => {
    const { findByText, getByText } = await render(<ClockInScreen />);
    await findByText("Enter your PIN");

    await enterPin(getByText, "1234");

    expect(await findByText("Set Branch")).toBeTruthy();
    expect(clockPunch).not.toHaveBeenCalled();
  });

  it("auto-submits and shows a successful clock-in result", async () => {
    useKioskStore.setState({ branchSlug: "main" });
    (clockPunch as jest.Mock).mockResolvedValue({
      employeeName: "Jane Doe",
      clockType: "clock_in",
    });

    const { findByText, getByText } = await render(<ClockInScreen />);
    await findByText("Enter your PIN");

    await enterPin(getByText, "1234");

    await waitFor(() =>
      expect(clockPunch).toHaveBeenCalledWith("1234", "main")
    );
    expect(await findByText("Jane Doe")).toBeTruthy();
    expect(await findByText("Clocked In")).toBeTruthy();
  });

  it("shows the server's error message on a failed punch", async () => {
    useKioskStore.setState({ branchSlug: "main" });
    (clockPunch as jest.Mock).mockRejectedValue(new Error("Employee is inactive."));

    const { findByText, getByText } = await render(<ClockInScreen />);
    await findByText("Enter your PIN");

    await enterPin(getByText, "1234");

    expect(await findByText("Employee is inactive.")).toBeTruthy();
  });

  it("falls back to a generic message for a request-failed error", async () => {
    useKioskStore.setState({ branchSlug: "main" });
    (clockPunch as jest.Mock).mockRejectedValue(new Error("Request failed with status 401"));

    const { findByText, getByText } = await render(<ClockInScreen />);
    await findByText("Enter your PIN");

    await enterPin(getByText, "1234");

    expect(await findByText("Invalid PIN. Please try again.")).toBeTruthy();
  });

  it("selecting a branch in the modal persists it and closes the modal", async () => {
    const { findByText, getByText, queryByText } = await render(<ClockInScreen />);
    await findByText("Enter your PIN");

    await enterPin(getByText, "1234");
    await findByText("Set Branch");

    await fireEvent.press(getByText("Main Branch"));

    await waitFor(() => expect(queryByText("Set Branch")).toBeNull());
    expect(useKioskStore.getState().branchSlug).toBe("main");
  });

  it("locking the kiosk hides the toolbar and shows the exit control", async () => {
    useKioskStore.setState({ branchSlug: "main" });

    const { findByText, getByText, queryByText } = await render(<ClockInScreen />);
    await findByText("Enter your PIN");

    await fireEvent.press(getByText("Enable Kiosk"));

    expect(useKioskStore.getState().isLocked).toBe(true);
    await waitFor(() => expect(queryByText("Change")).toBeNull());
  });

  it("exiting kiosk mode with a correct admin PIN unlocks it", async () => {
    useKioskStore.setState({ branchSlug: "main", isLocked: true });
    (verifyExitPin as jest.Mock).mockResolvedValue({ valid: true, configured: true });

    const { findByText, getByText, getByPlaceholderText, getByLabelText } = await render(
      <ClockInScreen />
    );
    await findByText("Enter your PIN");

    await fireEvent.press(getByLabelText("Exit kiosk mode"));
    await findByText("Exit Kiosk Mode");

    await fireEvent.changeText(getByPlaceholderText("••••"), "9999");
    await fireEvent.press(getByText("Confirm"));

    await waitFor(() => expect(verifyExitPin).toHaveBeenCalledWith("9999"));
    await waitFor(() => expect(useKioskStore.getState().isLocked).toBe(false));
  });

  it("shows 'Incorrect PIN.' for a wrong admin PIN and stays locked", async () => {
    useKioskStore.setState({ branchSlug: "main", isLocked: true });
    (verifyExitPin as jest.Mock).mockResolvedValue({ valid: false, configured: true });

    const { findByText, getByText, getByPlaceholderText, getByLabelText } = await render(
      <ClockInScreen />
    );
    await findByText("Enter your PIN");

    await fireEvent.press(getByLabelText("Exit kiosk mode"));
    await findByText("Exit Kiosk Mode");

    await fireEvent.changeText(getByPlaceholderText("••••"), "0000");
    await fireEvent.press(getByText("Confirm"));

    expect(await findByText("Incorrect PIN.")).toBeTruthy();
    expect(useKioskStore.getState().isLocked).toBe(true);
  });
});
