import { db } from "@/lib/db";
import { auditLog } from "@scheduler/database/schema";
import { logger } from "@/lib/logger";

type AuditParams = {
  organizationId: string;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      organizationId: params.organizationId,
      actorId: params.actorId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
      ip: params.ip ?? null,
    });
  } catch (err) {
    // Never let audit logging crash a request.
    logger.error("Failed to write audit log entry", err, params);
  }
}
