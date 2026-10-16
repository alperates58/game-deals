import { prisma } from "../db/prisma";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "secret",
  "clientsecret",
  "sessionsecret",
  "databaseurl",
  "smtppassword",
  "bottoken",
  "telegramsbottoken",
  "telegramchatid",
  "chatid",
  "webhooksecret",
  "cookie",
  "authorization",
]);

/**
 * Recursively redacts sensitive keys from audit log JSON payloads.
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token")
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeAuditData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface RecordAuditLogParams {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  targetUserId?: string | null;
  before?: any;
  after?: any;
  reason?: string | null;
  ipAddress?: string | null;
}

/**
 * Records a sanitized audit event in AdminAuditLog table.
 * Never throws error that could break business transactions.
 */
export async function recordAdminAuditLog(
  params: RecordAuditLogParams,
  db = prisma
): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        actorUserId: params.actorUserId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        targetUserId: params.targetUserId || null,
        beforeJson: params.before ? sanitizeAuditData(params.before) : undefined,
        afterJson: params.after ? sanitizeAuditData(params.after) : undefined,
        reason: params.reason || null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err: any) {
    console.error("[AuditLog Error] Failed to write audit log:", err?.message || err);
  }
}

export interface LogAdminAuditParams {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: any;
  reason?: string | null;
  ipAddress?: string | null;
}

export async function logAdminAudit(params: LogAdminAuditParams): Promise<void> {
  await recordAdminAuditLog({
    actorUserId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    after: params.details,
    reason: params.reason,
    ipAddress: params.ipAddress,
  });
}

