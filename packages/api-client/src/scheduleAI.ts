import { apiFetch } from "./client";
import type { ScheduleChatMessage } from "@scheduler/types";

export function chatScheduleAI(
  messages: ScheduleChatMessage[]
): Promise<{ reply: string }> {
  return apiFetch("/api/ai/schedule", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}
