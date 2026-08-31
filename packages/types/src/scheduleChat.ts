/**
 * Shared helpers for rendering the AI Schedule Assistant's chat messages —
 * used by both the web (`WeeklyScheduleGrid`) and mobile (`schedule-ai`)
 * clients. Deliberately structural/duck-typed against the shape of an AI SDK
 * `UIMessage` rather than importing the `ai` package's types, so this package
 * doesn't need `ai` as a dependency.
 */

export interface ScheduleChatTextPart {
  type: "text";
  text: string;
}

export interface ScheduleChatToolPart {
  type: `tool-${string}`;
  state?: string;
  output?: unknown;
}

export type ScheduleChatMessagePart = ScheduleChatTextPart | ScheduleChatToolPart | { type: string };

export interface ScheduleChatMessageLike {
  role: string;
  parts: ScheduleChatMessagePart[];
}

export const SCHEDULE_CHAT_GREETING =
  "Hi! I can help you assign employees to shifts. Tell me what you need — for example:\n\n• \"Assign 2 cooks and 1 waiter to Monday's morning shift\"\n• \"Who's available Friday afternoon?\"\n• \"Schedule the team for next week\"";

const SCHEDULE_CHAT_FALLBACK_TEXT = "I wasn't able to complete that request. Please try again.";

export function getScheduleChatMessageText(msg: ScheduleChatMessageLike): string {
  return msg.parts
    .filter((p): p is ScheduleChatTextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * A finished assistant turn can end with no text part at all — e.g. the agent
 * hit its step cap while still mid tool-call chain, with no trailing text
 * step. Only apply the fallback once the turn is actually done (`isStreaming`
 * false); an in-progress message legitimately has no text yet.
 */
export function getScheduleChatDisplayText(msg: ScheduleChatMessageLike, isStreaming: boolean): string {
  const text = getScheduleChatMessageText(msg);
  if (text || msg.role !== "assistant" || isStreaming) return text;
  return SCHEDULE_CHAT_FALLBACK_TEXT;
}

export function getScheduleChatSuccessfulToolCount(
  msg: ScheduleChatMessageLike,
  toolName: "assign_employee" | "create_shift"
): number {
  return msg.parts.filter((p): p is ScheduleChatToolPart => {
    if (p.type !== `tool-${toolName}` || !("state" in p) || p.state !== "output-available") return false;
    const output = (p as ScheduleChatToolPart).output;
    return !!output && typeof output === "object" && "success" in output && (output as { success?: boolean }).success === true;
  }).length;
}
