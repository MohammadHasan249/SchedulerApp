import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import SignupChoiceScreen from "../signup";

const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
  };
});

describe("SignupChoiceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both signup options", async () => {
    const { findByText } = await render(<SignupChoiceScreen />);

    expect(await findByText("Create Organization")).toBeTruthy();
    expect(await findByText("Join as Employee")).toBeTruthy();
  });

  it("navigates to signup-org when 'Create Organization' is pressed", async () => {
    const { findByText } = await render(<SignupChoiceScreen />);

    await fireEvent.press(await findByText("Create Organization"));

    expect(mockPush).toHaveBeenCalledWith("/(auth)/signup-org");
  });

  it("navigates to signup-employee when 'Join as Employee' is pressed", async () => {
    const { findByText } = await render(<SignupChoiceScreen />);

    await fireEvent.press(await findByText("Join as Employee"));

    expect(mockPush).toHaveBeenCalledWith("/(auth)/signup-employee");
  });
});
