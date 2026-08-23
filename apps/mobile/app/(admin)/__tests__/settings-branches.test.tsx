import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import SettingsBranchesScreen from "../settings-branches";
import { getBranches, createBranch, updateBranch, deleteBranch } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import type { Branch } from "@/lib/api";
import type { Session } from "@supabase/supabase-js";

jest.mock("@/lib/api", () => ({
  getBranches: jest.fn(),
  createBranch: jest.fn(),
  updateBranch: jest.fn(),
  deleteBranch: jest.fn(),
}));

// Render just the Stack.Screen's headerRight so the "+" add-branch button
// (which real navigation would place in the native header) stays testable.
jest.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) =>
      options?.headerRight ? options.headerRight() : null,
  },
}));

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: "branch-1",
    slug: "main",
    name: "Main Branch",
    address: null,
    timezone: "America/New_York",
    ...overrides,
  } as Branch;
}

function sessionWith(role: string, branchId?: string): Session {
  return {
    user: { id: "auth-1", app_metadata: { role, branch_id: branchId } },
  } as unknown as Session;
}

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

describe("SettingsBranchesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useAuthStore.setState({ session: sessionWith("org_admin") });
  });

  it("shows the empty state with an 'Add Branch' button for org_admin", async () => {
    (getBranches as jest.Mock).mockResolvedValue([]);

    const { findByText } = await render(<SettingsBranchesScreen />);

    expect(await findByText("No branches yet")).toBeTruthy();
    expect(await findByText("Add Branch")).toBeTruthy();
  });

  it("renders branch details", async () => {
    (getBranches as jest.Mock).mockResolvedValue([
      makeBranch({ address: "123 Main St" }),
    ]);

    const { findByText } = await render(<SettingsBranchesScreen />);

    expect(await findByText("Main Branch")).toBeTruthy();
    expect(await findByText("main")).toBeTruthy();
    expect(await findByText("123 Main St")).toBeTruthy();
    expect(await findByText("America/New_York")).toBeTruthy();
  });

  it("a branch manager only sees their own branch and no delete button", async () => {
    useAuthStore.setState({ session: sessionWith("branch_manager", "branch-1") });
    (getBranches as jest.Mock).mockResolvedValue([
      makeBranch({ id: "branch-1", name: "Mine" }),
      makeBranch({ id: "branch-2", name: "Other" }),
    ]);

    const { findByText, queryByText, queryByLabelText } = await render(
      <SettingsBranchesScreen />
    );

    expect(await findByText("Mine")).toBeTruthy();
    expect(queryByText("Other")).toBeNull();
    expect(queryByLabelText("Delete Mine")).toBeNull();
  });

  it("creates a new branch via the header '+' button", async () => {
    (getBranches as jest.Mock).mockResolvedValueOnce([]);
    (createBranch as jest.Mock).mockResolvedValue(makeBranch({ id: "new-1", name: "Uptown" }));

    const { findByText, getByText, getByPlaceholderText, getByLabelText } = await render(
      <SettingsBranchesScreen />
    );
    await findByText("No branches yet");

    await fireEvent.press(getByLabelText("Add branch"));
    await fireEvent.changeText(getByPlaceholderText("e.g. Downtown"), "Uptown");
    await fireEvent.press(getByText("Create Branch"));

    await waitFor(() =>
      expect(createBranch).toHaveBeenCalledWith({
        name: "Uptown",
        slug: undefined,
        address: undefined,
        timezone: "America/New_York",
      })
    );
    expect(await findByText("Uptown")).toBeTruthy();
  });

  it("requires a name before saving", async () => {
    (getBranches as jest.Mock).mockResolvedValue([]);

    const { findByText, getByText, getByLabelText } = await render(<SettingsBranchesScreen />);
    await findByText("No branches yet");

    await fireEvent.press(getByLabelText("Add branch"));
    await fireEvent.press(getByText("Create Branch"));

    expect(await findByText("Name is required.")).toBeTruthy();
    expect(createBranch).not.toHaveBeenCalled();
  });

  it("edits an existing branch", async () => {
    const branch = makeBranch();
    (getBranches as jest.Mock).mockResolvedValue([branch]);
    (updateBranch as jest.Mock).mockResolvedValue({ ...branch, name: "Renamed" });

    const { findByText, getByLabelText, getByPlaceholderText, getByText } = await render(
      <SettingsBranchesScreen />
    );
    await findByText("Main Branch");

    await fireEvent.press(getByLabelText("Edit Main Branch"));
    await fireEvent.changeText(getByPlaceholderText("e.g. Downtown"), "Renamed");
    await fireEvent.press(getByText("Save Changes"));

    await waitFor(() =>
      expect(updateBranch).toHaveBeenCalledWith(
        "branch-1",
        expect.objectContaining({ name: "Renamed" })
      )
    );
    expect(await findByText("Renamed")).toBeTruthy();
  });

  it("deletes a branch after confirming", async () => {
    const branch = makeBranch();
    (getBranches as jest.Mock).mockResolvedValue([branch]);
    (deleteBranch as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByLabelText, queryByText } = await render(<SettingsBranchesScreen />);
    await findByText("Main Branch");

    await fireEvent.press(getByLabelText("Delete Main Branch"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Delete Branch",
      'Delete "Main Branch"? This cannot be undone.',
      expect.any(Array)
    );
    const confirmBtn = alertButtons().find((b) => b.text === "Delete");
    await act(async () => {
      await confirmBtn?.onPress?.();
    });

    await waitFor(() => expect(deleteBranch).toHaveBeenCalledWith("branch-1"));
    await waitFor(() => expect(queryByText("Main Branch")).toBeNull());
  });

  it("shows an alert when deleting fails", async () => {
    const branch = makeBranch();
    (getBranches as jest.Mock).mockResolvedValue([branch]);
    (deleteBranch as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText, getByLabelText } = await render(<SettingsBranchesScreen />);
    await findByText("Main Branch");

    await fireEvent.press(getByLabelText("Delete Main Branch"));
    const confirmBtn = alertButtons().find((b) => b.text === "Delete");
    await act(async () => {
      await confirmBtn?.onPress?.();
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to delete branch.")
    );
  });

  it("picks a timezone from the picker", async () => {
    (getBranches as jest.Mock).mockResolvedValue([]);

    const { findByText, getByText, getByLabelText } = await render(<SettingsBranchesScreen />);
    await findByText("No branches yet");

    await fireEvent.press(getByLabelText("Add branch"));
    await fireEvent.press(getByText("Eastern Time (ET)"));
    await fireEvent.press(getByText("Pacific Time (PT)"));

    expect(await findByText("Pacific Time (PT)")).toBeTruthy();
  });
});
