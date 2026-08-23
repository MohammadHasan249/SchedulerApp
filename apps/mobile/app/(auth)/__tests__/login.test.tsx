import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "../login";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
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
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("calls signInWithPassword with the entered credentials", async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ error: null });

    const { getByPlaceholderText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "hunter2");
    await fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "hunter2",
      });
    });
  });

  it("shows a 'Login failed' alert when the API returns an error", async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const { getByPlaceholderText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "wrong-password");
    await fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Login failed", "Invalid login credentials");
    });
  });

  it("does not alert on a successful login", async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ error: null });

    const { getByPlaceholderText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "hunter2");
    await fireEvent.press(getByText("Sign In"));

    await waitFor(() => expect(supabase.auth.signInWithPassword).toHaveBeenCalled());
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
