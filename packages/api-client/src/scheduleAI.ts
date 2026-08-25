import { apiFetch } from "./client";
import type { ScheduleChatMessage, ScheduleChatAction } from "@scheduler/types";

export function chatScheduleAI(
  messages: ScheduleChatMessage[]
): Promise<{ reply: string; actions?: ScheduleChatAction[] }> {
  return apiFetch("/api/ai/schedule", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}
