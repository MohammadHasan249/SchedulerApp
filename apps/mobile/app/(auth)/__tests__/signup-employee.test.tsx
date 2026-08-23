import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SignupEmployeeScreen from "../signup-employee";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

describe("SignupEmployeeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    global.fetch = jest.fn();
  });

  it("rejects an invalid email without calling the API", async () => {
    const { getByPlaceholderText, getByText } = await render(<SignupEmployeeScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "not-an-email");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "password123");
    await fireEvent.press(getByText("Create Account"));

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter a valid email address.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a short password without calling the API", async () => {
    const { getByPlaceholderText, getByText } = await render(<SignupEmployeeScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "short");
    await fireEvent.press(getByText("Create Account"));

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Password must be at least 8 characters.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits valid credentials to the employee-signup endpoint", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { getByPlaceholderText, getByText } = await render(<SignupEmployeeScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "password123");
    await fireEvent.press(getByText("Create Account"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/auth/employee-signup");
    expect(JSON.parse(options.body)).toEqual({ email: "jane@example.com", password: "password123" });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Check your email",
        "Confirm your email, then sign in to continue.",
        expect.any(Array)
      )
    );

    alertButtons()[0]?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("shows the server error message when the API rejects the signup", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Email already invited" }),
    });

    const { getByPlaceholderText, getByText } = await render(<SignupEmployeeScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "password123");
    await fireEvent.press(getByText("Create Account"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Signup failed", "Email already invited")
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows a generic failure alert when fetch itself throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));

    const { getByPlaceholderText, getByText } = await render(<SignupEmployeeScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "password123");
    await fireEvent.press(getByText("Create Account"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Signup failed", "network down"));
  });
});
