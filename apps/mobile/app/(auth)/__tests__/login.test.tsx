import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "../login";
import { supabase } from "@/lib/supabase";
import { mobileLogin } from "@/lib/api";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/api", () => ({
  mobileLogin: jest.fn(),
}));

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("shows an error and does not call the API when fields are empty", async () => {
    const { getByText } = await render(<LoginScreen />);

    await fireEvent.press(getByText("Sign In"));

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter your email and password");
    expect(mobileLogin).not.toHaveBeenCalled();
  });

  it("logs in via the mobile-login route and sets the returned session", async () => {
    (mobileLogin as jest.Mock).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
    });
    (supabase.auth.setSession as jest.Mock).mockResolvedValue({ error: null });

    const { getByPlaceholderText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "hunter2");
    await fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(mobileLogin).toHaveBeenCalledWith("jane@example.com", "hunter2", expect.any(String));
    });
    await waitFor(() => {
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: "at",
        refresh_token: "rt",
      });
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows a 'Login failed' alert when mobileLogin rejects", async () => {
    (mobileLogin as jest.Mock).mockRejectedValue(new Error("Invalid email or password"));

    const { getByPlaceholderText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "wrong-password");
    await fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Login failed", "Invalid email or password");
    });
  });

  it("surfaces a rate-limit message distinctly from bad credentials", async () => {
    (mobileLogin as jest.Mock).mockRejectedValue(new Error("Too many attempts. Try again later."));

    const { getByPlaceholderText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "hunter2");
    await fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Login failed", "Too many attempts. Try again later.");
    });
  });

  it("shows a 'Login failed' alert when setSession errors", async () => {
    (mobileLogin as jest.Mock).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
    });
    (supabase.auth.setSession as jest.Mock).mockResolvedValue({
      error: { message: "boom" },
    });

    const { getByPlaceholderText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "hunter2");
    await fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Login failed", "Invalid email or password");
    });
  });
});
