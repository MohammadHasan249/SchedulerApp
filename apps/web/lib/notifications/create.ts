import { db } from "@/lib/db";
import { notifications } from "@scheduler/database/schema";

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
    console.error("Failed to create notification:", error);
  }
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await db.insert(notifications).values(inputs);
  } catch (error) {
    console.error("Failed to create notifications:", error);
  }
}
