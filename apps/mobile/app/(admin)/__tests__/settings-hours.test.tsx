import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SettingsHoursScreen from "../settings-hours";
import { getOrganizationHours, updateOrganizationHours } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  getOrganizationHours: jest.fn(),
  updateOrganizationHours: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

describe("SettingsHoursScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("loads saved hours and shows a closed day as toggled off", async () => {
    (getOrganizationHours as jest.Mock).mockResolvedValue({
      "1": { startTime: "08:00", endTime: "18:00" },
    });

    const { findByText, getAllByDisplayValue } = await render(<SettingsHoursScreen />);
    await findByText("Monday");

    expect((await getAllByDisplayValue("08:00")).length).toBeGreaterThan(0);
    // Sunday (index 0) has no saved slot, so it should be toggled off and
    // render no time inputs.
    expect(await findByText("Sunday")).toBeTruthy();
  });

  it("defaults to every day enabled 09:00-17:00 when the API call fails", async () => {
    (getOrganizationHours as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findAllByDisplayValue } = await render(<SettingsHoursScreen />);

    expect((await findAllByDisplayValue("09:00")).length).toBe(7);
    expect((await findAllByDisplayValue("17:00")).length).toBe(7);
  });

  it("toggling a day off hides its time inputs", async () => {
    (getOrganizationHours as jest.Mock).mockResolvedValue({
      "1": { startTime: "09:00", endTime: "17:00" },
    });

    const { findByText, getAllByRole } = await render(<SettingsHoursScreen />);
    await findByText("Monday");

    const switches = getAllByRole("switch");
    await fireEvent(switches[1], "valueChange", false);

    await waitFor(() => expect(switches[1].props.value).toBe(false));
  });

  it("saves the current schedule and shows a confirmation", async () => {
    (getOrganizationHours as jest.Mock).mockResolvedValue({
      "1": { startTime: "09:00", endTime: "17:00" },
    });
    (updateOrganizationHours as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByText } = await render(<SettingsHoursScreen />);
    await findByText("Monday");

    await fireEvent.press(getByText("Save Hours"));

    await waitFor(() =>
      expect(updateOrganizationHours).toHaveBeenCalledWith({
        "1": { startTime: "09:00", endTime: "17:00" },
      })
    );
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Saved", "Organization hours updated.")
    );
  });

  it("shows an error alert when saving fails", async () => {
    (getOrganizationHours as jest.Mock).mockResolvedValue({});
    (updateOrganizationHours as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText, getByText } = await render(<SettingsHoursScreen />);
    await findByText("Save Hours");

    await fireEvent.press(getByText("Save Hours"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to save. Please try again.")
    );
  });
});
