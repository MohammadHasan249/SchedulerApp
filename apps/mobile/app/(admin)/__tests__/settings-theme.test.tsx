import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SettingsThemeScreen from "../settings-theme";
import { getOrganizationTheme, updateOrganizationTheme } from "@/lib/api";
import { useThemeStore } from "@/lib/themeStore";

jest.mock("@/lib/api", () => ({
  getOrganizationTheme: jest.fn(),
  updateOrganizationTheme: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

describe("SettingsThemeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useThemeStore.setState({ theme: null });
    (getOrganizationTheme as jest.Mock).mockResolvedValue(null);
  });

  it("renders every theme preset", async () => {
    const { findByText } = await render(<SettingsThemeScreen />);

    expect(await findByText("Blue")).toBeTruthy();
    expect(await findByText("Indigo")).toBeTruthy();
    expect(await findByText("Violet")).toBeTruthy();
    expect(await findByText("Emerald")).toBeTruthy();
    expect(await findByText("Crimson")).toBeTruthy();
    expect(await findByText("Amber")).toBeTruthy();
  });

  it("disables save until a preset is selected", async () => {
    const { findByText, getByText } = await render(<SettingsThemeScreen />);
    await findByText("Blue");

    await fireEvent.press(getByText("Save Theme"));

    expect(updateOrganizationTheme).not.toHaveBeenCalled();
  });

  it("saves the selected preset and updates the theme store", async () => {
    (updateOrganizationTheme as jest.Mock).mockResolvedValue({
      primary: "#4f46e5",
      secondary: "#64748b",
      accent: "#06b6d4",
      background: "#ffffff",
      foreground: "#000000",
    });

    const { findByText, getByText } = await render(<SettingsThemeScreen />);
    await findByText("Indigo");

    await fireEvent.press(getByText("Indigo"));
    await fireEvent.press(getByText("Save Theme"));

    await waitFor(() =>
      expect(updateOrganizationTheme).toHaveBeenCalledWith(
        expect.objectContaining({ primary: "#4f46e5" })
      )
    );
    await waitFor(() =>
      expect(useThemeStore.getState().theme?.primary).toBe("#4f46e5")
    );
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Saved", "Theme updated."));
  });

  it("preselects the preset matching the org's saved theme", async () => {
    (getOrganizationTheme as jest.Mock).mockResolvedValue({ primary: "#7c3aed" });
    (updateOrganizationTheme as jest.Mock).mockResolvedValue({ primary: "#7c3aed" });

    const { findByText, getByText } = await render(<SettingsThemeScreen />);
    await findByText("Violet");

    // Save should already be enabled since a preset was preselected.
    await fireEvent.press(getByText("Save Theme"));

    await waitFor(() =>
      expect(updateOrganizationTheme).toHaveBeenCalledWith(
        expect.objectContaining({ primary: "#7c3aed" })
      )
    );
  });

  it("shows an error alert when saving fails", async () => {
    (updateOrganizationTheme as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText, getByText } = await render(<SettingsThemeScreen />);
    await findByText("Blue");

    await fireEvent.press(getByText("Blue"));
    await fireEvent.press(getByText("Save Theme"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to save. Please try again.")
    );
  });
});
