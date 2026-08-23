import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { pushTokens } from "@scheduler/database/schema";
import { inArray } from "drizzle-orm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export async function sendPushToEmployees(employeeIds: string[], message: string): Promise<void> {
  if (employeeIds.length === 0) return;

  try {
    const tokens = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(inArray(pushTokens.employeeId, employeeIds));

    if (tokens.length === 0) return;

    const messages = tokens.map(({ token }) => ({ to: token, sound: "default", body: message }));

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
    }
  } catch (error) {
    logger.error("Failed to send push notifications:", error);
  }
}
