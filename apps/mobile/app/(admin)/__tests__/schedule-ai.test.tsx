import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ScheduleAIScreen from "../schedule-ai";
import { chatScheduleAI } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  chatScheduleAI: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

describe("ScheduleAIScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the greeting message", async () => {
    const { findByText } = await render(<ScheduleAIScreen />);

    expect(await findByText(/I can help you assign employees/)).toBeTruthy();
  });

  it("does not send when the input is empty", async () => {
    const { findByPlaceholderText } = await render(<ScheduleAIScreen />);
    const input = await findByPlaceholderText("Message the AI assistant...");

    await fireEvent(input, "submitEditing");

    expect(chatScheduleAI).not.toHaveBeenCalled();
  });

  it("sends a message and renders the AI's reply", async () => {
    (chatScheduleAI as jest.Mock).mockResolvedValue({ reply: "Done! I assigned 2 cooks." });

    const { findByPlaceholderText, findByText } = await render(<ScheduleAIScreen />);
    await findByText(/I can help you assign employees/);

    const input = await findByPlaceholderText("Message the AI assistant...");
    await fireEvent.changeText(input, "Assign 2 cooks to Monday");
    await fireEvent(input, "submitEditing");

    await waitFor(() =>
      expect(chatScheduleAI).toHaveBeenCalledWith([{ role: "user", content: "Assign 2 cooks to Monday" }])
    );
    expect(await findByText("Done! I assigned 2 cooks.")).toBeTruthy();
  });

  it("clears the input after sending", async () => {
    (chatScheduleAI as jest.Mock).mockResolvedValue({ reply: "OK" });

    const { findByText, findByPlaceholderText } = await render(<ScheduleAIScreen />);
    await findByText(/I can help you assign employees/);

    const input = await findByPlaceholderText("Message the AI assistant...");
    await fireEvent.changeText(input, "Hello");
    await fireEvent(input, "submitEditing");

    await waitFor(() => expect((input.props as { value: string }).value).toBe(""));
  });

  it("shows a fallback message when the API call fails", async () => {
    (chatScheduleAI as jest.Mock).mockRejectedValue(new Error("network down"));

    const { findByText, findByPlaceholderText } = await render(<ScheduleAIScreen />);
    await findByText(/I can help you assign employees/);

    const input = await findByPlaceholderText("Message the AI assistant...");
    await fireEvent.changeText(input, "Hello");
    await fireEvent(input, "submitEditing");

    expect(await findByText("Sorry, something went wrong. Please try again.")).toBeTruthy();
  });

  it("does not send an empty or whitespace-only message", async () => {
    const { findByText, findByPlaceholderText } = await render(<ScheduleAIScreen />);
    await findByText(/I can help you assign employees/);

    const input = await findByPlaceholderText("Message the AI assistant...");
    await fireEvent.changeText(input, "   ");
    await fireEvent(input, "submitEditing");

    expect(chatScheduleAI).not.toHaveBeenCalled();
  });
});
