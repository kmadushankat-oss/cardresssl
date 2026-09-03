import { headers } from "next/headers";

import { db } from "@/lib/db";

export type AuditEntry = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  /** Field-level before/after, for the diff view in the admin. */
  changes?: unknown;
};

/**
 * Record an administrative action.
 *
 * Deliberately never throws: an audit failure must not roll back the business
 * operation the user just performed. Failures are logged for investigation.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const h = await headers();
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? null,
        changes: (entry.changes ?? undefined) as never,
        ip:
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          h.get("x-real-ip") ??
          null,
        userAgent: h.get("user-agent") ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", entry.action, entry.entity, error);
  }
}

/**
 * Shallow diff of two records, limited to `fields`, keeping only what actually
 * changed. Keeps the audit log readable instead of dumping whole rows.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T,
  fields: readonly (keyof T)[],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    const from = before?.[field];
    const to = after[field];
    // Compare stringified values so Decimal and Date instances behave.
    if (String(from ?? "") !== String(to ?? "")) {
      changes[String(field)] = { from: from ?? null, to: to ?? null };
    }
  }
  return changes;
}
