import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SignupOrgScreen from "../signup-org";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: () => null },
}));

function alertButtons(): { text: string; onPress?: () => void }[] {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return call?.[2] ?? [];
}

async function fillValidForm(
  getByPlaceholderText: Awaited<ReturnType<typeof render>>["getByPlaceholderText"]
) {
  await fireEvent.changeText(getByPlaceholderText("Acme Inc"), "Acme Inc");
  await fireEvent.changeText(getByPlaceholderText("Jane Smith"), "Jane Smith");
  await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
  await fireEvent.changeText(getByPlaceholderText("••••••••"), "password123");
}

describe("SignupOrgScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    global.fetch = jest.fn();
  });

  it("auto-derives the slug from the org name until the slug is manually edited", async () => {
    const { getByPlaceholderText } = await render(<SignupOrgScreen />);

    await fireEvent.changeText(getByPlaceholderText("Acme Inc"), "My Cool Org!");
    expect(getByPlaceholderText("acme-inc").props.value).toBe("my-cool-org");

    await fireEvent.changeText(getByPlaceholderText("acme-inc"), "custom-slug");
    await fireEvent.changeText(getByPlaceholderText("Acme Inc"), "Something Else");
    expect(getByPlaceholderText("acme-inc").props.value).toBe("custom-slug");
  });

  it("rejects a too-short org name without calling the API", async () => {
    const { getByPlaceholderText, getAllByText } = await render(<SignupOrgScreen />);

    await fireEvent.changeText(getByPlaceholderText("Acme Inc"), "A");
    await fireEvent.press(getAllByText("Create Organization").at(-1)!);

    expect(Alert.alert).toHaveBeenCalledWith(
      "Error",
      "Organization name must be at least 2 characters."
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a missing full name without calling the API", async () => {
    const { getByPlaceholderText, getAllByText } = await render(<SignupOrgScreen />);

    await fireEvent.changeText(getByPlaceholderText("Acme Inc"), "Acme Inc");
    await fireEvent.press(getAllByText("Create Organization").at(-1)!);

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter your full name.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without calling the API", async () => {
    const { getByPlaceholderText, getAllByText } = await render(<SignupOrgScreen />);

    await fireEvent.changeText(getByPlaceholderText("Acme Inc"), "Acme Inc");
    await fireEvent.changeText(getByPlaceholderText("Jane Smith"), "Jane Smith");
    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "not-an-email");
    await fireEvent.press(getAllByText("Create Organization").at(-1)!);

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter a valid email address.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a short password without calling the API", async () => {
    const { getByPlaceholderText, getAllByText } = await render(<SignupOrgScreen />);

    await fireEvent.changeText(getByPlaceholderText("Acme Inc"), "Acme Inc");
    await fireEvent.changeText(getByPlaceholderText("Jane Smith"), "Jane Smith");
    await fireEvent.changeText(getByPlaceholderText("you@example.com"), "jane@example.com");
    await fireEvent.changeText(getByPlaceholderText("••••••••"), "short");
    await fireEvent.press(getAllByText("Create Organization").at(-1)!);

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Password must be at least 8 characters.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits valid data to the org endpoint and navigates to login on confirm", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { getByPlaceholderText, getAllByText } = await render(<SignupOrgScreen />);
    await fillValidForm(getByPlaceholderText);
    await fireEvent.press(getAllByText("Create Organization").at(-1)!);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/org");
    expect(JSON.parse(options.body)).toEqual({
      orgName: "Acme Inc",
      orgSlug: "acme-inc",
      industry: "restaurant",
      fullName: "Jane Smith",
      email: "jane@example.com",
      password: "password123",
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Check your email",
        "Your organization was created. Confirm your email, then sign in to continue.",
        expect.any(Array)
      )
    );

    alertButtons()[0]?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("surfaces a field-level slug error from the API response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { fieldErrors: { orgSlug: ["Slug already taken"] } } }),
    });

    const { getByPlaceholderText, getAllByText } = await render(<SignupOrgScreen />);
    await fillValidForm(getByPlaceholderText);
    await fireEvent.press(getAllByText("Create Organization").at(-1)!);

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Signup failed", "Slug already taken")
    );
  });

  it("shows a generic failure alert when fetch itself throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));

    const { getByPlaceholderText, getAllByText } = await render(<SignupOrgScreen />);
    await fillValidForm(getByPlaceholderText);
    await fireEvent.press(getAllByText("Create Organization").at(-1)!);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Signup failed", "network down"));
  });
});
