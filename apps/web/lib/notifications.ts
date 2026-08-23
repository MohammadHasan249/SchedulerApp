import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { notifications } from "@scheduler/database/schema";
import { sendPushToEmployees } from "@/lib/push";

type CreateNotificationInput = {
  employeeId: string;
  organizationId: string;
  message: string;
};

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await db.insert(notifications).values({
      employeeId: input.employeeId,
      organizationId: input.organizationId,
      message: input.message,
    });
  } catch (error) {
    logger.error("Failed to create notification:", error);
  }
  await sendPushToEmployees([input.employeeId], input.message);
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await db.insert(notifications).values(inputs);
  } catch (error) {
    logger.error("Failed to create notifications:", error);
  }
  await Promise.all(inputs.map((input) => sendPushToEmployees([input.employeeId], input.message)));
}
