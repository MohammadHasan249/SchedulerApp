import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAgentUIStreamResponse } from "ai";
import { safeJson } from "@/lib/utils/safe-json";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { createScheduleAgent } from "@/lib/ai/schedule-agent";

const AI_RATE_LIMIT = { maxAttempts: 20, windowMs: 60 * 60 * 1000 };

// Only the last N messages are sent to the model each turn — keeps cost/latency
// bounded on long conversations while retaining enough context for a multi-turn
// assignment flow ("assign him to that shift too").
const HISTORY_LIMIT = 6;

// Shape-level validation only — parts are a large tagged union owned by the AI
// SDK, which does its own full validation of `uiMessages` against the agent's
// tools inside `createAgentUIStreamResponse`. This just keeps obviously
// malformed payloads (missing id/role/parts) from reaching that point.
//
// "system" is deliberately excluded: the agent's own `instructions` already
// carry the system prompt, and createScheduleAgent doesn't set
// allowSystemInMessages, so a client-supplied system message would otherwise
// pass this schema only to throw deep inside the AI SDK and surface as a bare
// 500 instead of the 400 a malformed-payload caller should get.
const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.unknown()),
});

const requestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1),
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  if (user.role === "employee") {
    logger.warn("Schedule AI request forbidden: employee role", { userId: user.id });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    logger.warn("Schedule AI request rejected: AI_GATEWAY_API_KEY not configured");
    return NextResponse.json(
      { error: "AI assistant is not configured." },
      { status: 503 }
    );
  }

  // Rate-limit by org. Each request can trigger up to 10 model calls — left
  // unbounded, a single tab open in a browser could rack up real $ in minutes.
  const rl = await checkRateLimit(`ai:${user.organizationId}`, AI_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    logger.warn("Schedule AI request rate-limited", {
      organizationId: user.organizationId,
      retryAfterSec,
    });
    return NextResponse.json(
      { error: "AI quota exhausted for this hour. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("Schedule AI request failed validation", parsed.error.flatten());
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const uiMessages = parsed.data.messages.slice(-HISTORY_LIMIT);

  try {
    const agent = await createScheduleAgent(user);
    return await createAgentUIStreamResponse({
      agent,
      uiMessages,
      timeout: 30_000,
    });
  } catch (e) {
    const isTimeout = e instanceof DOMException && e.name === "TimeoutError";
    // Timeouts are an expected, noisy condition — log them without
    // reporting to Sentry (logger.error reports; logger.warn doesn't).
    if (isTimeout) {
      logger.warn("Schedule AI agent timed out:", e);
    } else {
      logger.error("Schedule AI agent failed:", e);
    }
    return NextResponse.json(
      { error: isTimeout ? "AI service timed out" : "AI service error" },
      { status: isTimeout ? 504 : 500 }
    );
  }
});
