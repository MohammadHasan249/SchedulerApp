import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SettingsExitPinScreen from "../settings-exit-pin";
import { setExitPin } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  setExitPin: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

describe("SettingsExitPinScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("disables the save button until both PIN fields match a valid 4+ digit PIN", async () => {
    const { findByText, getByText, getAllByPlaceholderText } = await render(
      <SettingsExitPinScreen />
    );
    const [pinInput, confirmInput] = getAllByPlaceholderText("••••");
    const button = await findByText("Set Exit PIN");

    await fireEvent.press(button);
    expect(setExitPin).not.toHaveBeenCalled();

    await fireEvent.changeText(pinInput, "12");
    await fireEvent.changeText(confirmInput, "12");
    await fireEvent.press(getByText("Set Exit PIN"));
    expect(setExitPin).not.toHaveBeenCalled();
  });

  it("shows a mismatch error when the confirmation differs", async () => {
    const { findByText, getAllByPlaceholderText } = await render(<SettingsExitPinScreen />);
    const [pinInput, confirmInput] = getAllByPlaceholderText("••••");
    await findByText("Set Exit PIN");

    await fireEvent.changeText(pinInput, "1234");
    await fireEvent.changeText(confirmInput, "1235");

    expect(await findByText("PINs do not match.")).toBeTruthy();
    expect(setExitPin).not.toHaveBeenCalled();
  });

  it("saves a valid matching PIN and clears the fields", async () => {
    (setExitPin as jest.Mock).mockResolvedValue(undefined);

    const { findByText, getByText, getAllByPlaceholderText } = await render(
      <SettingsExitPinScreen />
    );
    const [pinInput, confirmInput] = getAllByPlaceholderText("••••");
    await findByText("Set Exit PIN");

    await fireEvent.changeText(pinInput, "1234");
    await fireEvent.changeText(confirmInput, "1234");
    await fireEvent.press(getByText("Set Exit PIN"));

    await waitFor(() => expect(setExitPin).toHaveBeenCalledWith("1234"));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Saved", "Kiosk exit PIN updated.")
    );
    await waitFor(() => expect((pinInput.props as { value: string }).value).toBe(""));
  });

  it("shows an error alert when saving fails", async () => {
    (setExitPin as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText, getByText, getAllByPlaceholderText } = await render(
      <SettingsExitPinScreen />
    );
    const [pinInput, confirmInput] = getAllByPlaceholderText("••••");
    await findByText("Set Exit PIN");

    await fireEvent.changeText(pinInput, "1234");
    await fireEvent.changeText(confirmInput, "1234");
    await fireEvent.press(getByText("Set Exit PIN"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to save PIN. Please try again.")
    );
  });
});
