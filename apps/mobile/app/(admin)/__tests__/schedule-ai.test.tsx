import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ScheduleAIScreen from "../schedule-ai";
import { useChat } from "@ai-sdk/react";

jest.mock("@ai-sdk/react", () => ({ useChat: jest.fn() }));
// Real "ai" pulls in the AI Gateway provider's transitive ESM deps, which the
// RN/Jest CJS transform chain can't parse — the component only needs
// `DefaultChatTransport` to be constructible, and `useChat` is mocked above
// anyway, so a stub is enough.
jest.mock("ai", () => ({ DefaultChatTransport: jest.fn() }));
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));
jest.mock("@/lib/api", () => ({
  getApiBaseUrl: () => "https://api.test",
  createAuthenticatedFetch: (f: unknown) => f,
}));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

const mockUseChat = useChat as jest.Mock;
const sendMessage = jest.fn();

function setChatState(overrides: Partial<ReturnType<typeof useChat>> = {}) {
  mockUseChat.mockReturnValue({
    messages: [],
    sendMessage,
    status: "ready",
    error: undefined,
    ...overrides,
  });
}

describe("ScheduleAIScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setChatState();
  });

  it("shows the greeting message when there are no messages yet", async () => {
    const { findByText } = await render(<ScheduleAIScreen />);

    expect(await findByText(/I can help you assign employees/)).toBeTruthy();
  });

  it("does not send when the input is empty", async () => {
    const { findByPlaceholderText } = await render(<ScheduleAIScreen />);
    const input = await findByPlaceholderText("Message the AI assistant...");

    await fireEvent(input, "submitEditing");

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not send an empty or whitespace-only message", async () => {
    const { findByPlaceholderText } = await render(<ScheduleAIScreen />);
    const input = await findByPlaceholderText("Message the AI assistant...");

    await fireEvent.changeText(input, "   ");
    await fireEvent(input, "submitEditing");

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends a message via the chat transport and clears the input", async () => {
    const { findByPlaceholderText } = await render(<ScheduleAIScreen />);
    const input = await findByPlaceholderText("Message the AI assistant...");

    await fireEvent.changeText(input, "Assign 2 cooks to Monday");
    await fireEvent(input, "submitEditing");

    expect(sendMessage).toHaveBeenCalledWith({ text: "Assign 2 cooks to Monday" });
    await waitFor(() => expect((input.props as { value: string }).value).toBe(""));
  });

  it("renders the assistant's streamed reply from message parts", async () => {
    setChatState({
      messages: [
        {
          id: "m1",
          role: "assistant",
          parts: [{ type: "text", text: "Done! I assigned 2 cooks." }],
        },
      ] as unknown as ReturnType<typeof useChat>["messages"],
    });

    const { findByText } = await render(<ScheduleAIScreen />);

    expect(await findByText("Done! I assigned 2 cooks.")).toBeTruthy();
  });

  it("shows an assignment-made chip for a successful assign_employee tool part", async () => {
    setChatState({
      messages: [
        {
          id: "m1",
          role: "assistant",
          parts: [
            { type: "text", text: "Assigned Emp One." },
            {
              type: "tool-assign_employee",
              state: "output-available",
              output: { success: true },
            },
          ],
        },
      ] as unknown as ReturnType<typeof useChat>["messages"],
    });

    const { findByText } = await render(<ScheduleAIScreen />);

    expect(await findByText("✓ 1 assignment made")).toBeTruthy();
  });

  it("shows the loading indicator while streaming", async () => {
    setChatState({ status: "streaming" });

    const { getByTestId } = await render(<ScheduleAIScreen />);

    // ActivityIndicator has no accessible text; assert via the send button's
    // disabled state instead, which mirrors the loading flag.
    const input = await getByTestId("ai-chat-send-button");
    expect(input.props.accessibilityState?.disabled).toBe(true);
  });

  it("shows a fallback message when the chat transport errors", async () => {
    setChatState({ error: new Error("network down") });

    const { findByText } = await render(<ScheduleAIScreen />);

    expect(await findByText("Sorry, something went wrong. Please try again.")).toBeTruthy();
  });
});
