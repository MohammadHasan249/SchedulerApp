import { ToolLoopAgent, isStepCount, type InferAgentUIMessage, type LanguageModel } from "ai";
import type { AppUser } from "@/lib/auth/getUser";
import { buildScheduleTools, MAX_SHIFT_HOURS } from "./schedule-tools";
import { formatZonedDateTime } from "@/lib/utils/timezone";

const MODEL = "deepseek/deepseek-v3.2";
const MAX_OUTPUT_TOKENS = 500;
const MAX_STEPS = 10;

function buildSystemPrompt(promptTimezone: string): string {
  return `You are a scheduling assistant for a workforce management app. You help managers assign employees to shifts.

Hard constraints enforced by the system (the assign_employee tool will reject violations with a clear error):
1. Shifts cannot exceed ${MAX_SHIFT_HOURS} hours.
2. Employees can only be assigned within their availability window for that day of week.
3. Employees with approved time off on a day cannot be assigned shifts that day.
4. Employees cannot exceed their maximum hours per week.

Timezone: all shift and employee times you see (from list_shifts, list_employees, etc.) and all times you pass to create_shift are in the branch's own local timezone (shown per-branch as "timezone"), never UTC. Reason and communicate in that local time.

Your job:
- If the user refers to a shift, employee, branch, or job role by day/name rather than by reference, you MUST call the matching list_* tool first to resolve it to a reference before doing anything else — never guess a reference.
- To create a new shift, call create_shift with the start/end time (and branchId if there is more than one branch — call list_branches to get it).
- Prefer employees whose job role matches what the shift needs.
- Once you have resolved the shift and employee, you MUST actually call assign_employee — do not just describe the assignment in words. Never tell the user an employee has been assigned unless you called assign_employee and it returned success.
- If a reference is genuinely ambiguous (e.g. multiple shifts match "Monday"), or the user's request is missing information you need (which employee, which shift, how many people), stop and ask one concise clarifying question instead of guessing. Do not claim an assignment was made.
- When a constraint blocks an assignment or shift creation, explain why and suggest alternatives if possible.
- After completing actions, summarize what was done in plain terms (names, dates, times, roles) — never mention IDs, references, or handles like "shift_1" in your reply to the user, those are internal only.

Reply style: your reply is shown directly to the user in a chat UI — it is not a scratchpad. Never include reasoning, planning, step-by-step thinking, or a list of what tools you called; just the outcome. Keep replies to a sentence or two: a plain confirmation of what happened, a direct answer, or a single clarifying question. No preamble, no restating the request back.

Today is ${formatZonedDateTime(new Date(), promptTimezone)} (${promptTimezone}).`;
}

/**
 * Builds a fresh, request-scoped schedule agent. Cheap to construct per
 * request — the handle registry and branch-timezone cache inside
 * `buildScheduleTools` must not leak across requests/users.
 */
export async function createScheduleAgent(user: AppUser, model: LanguageModel = MODEL) {
  const { tools, getScopedBranchIds, getBranchTimezone } = buildScheduleTools(user);

  // "Today" and all shift/employee times must be anchored to the org's own
  // timezone, not the server's UTC clock — pick a representative branch
  // (the manager's own branch, or the first in scope for multi-branch admins).
  const scopedBranchIds = await getScopedBranchIds();
  const promptTimezone = scopedBranchIds.length > 0 ? await getBranchTimezone(scopedBranchIds[0]) : "UTC";

  return new ToolLoopAgent({
    model,
    instructions: buildSystemPrompt(promptTimezone),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.3,
  });
}

export type ScheduleAgent = Awaited<ReturnType<typeof createScheduleAgent>>;
export type ScheduleAgentUIMessage = InferAgentUIMessage<ScheduleAgent>;
