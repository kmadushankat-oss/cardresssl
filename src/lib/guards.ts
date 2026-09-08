import type { UserRole } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/action-result";

/**
 * Refuse to leave the system with no active owner.
 *
 * Only an OWNER holds `user:changeRole`, so if the last owner is demoted,
 * deactivated or deleted, nobody can ever assign the role again — the system
 * is recoverable only by editing the database directly. `user:update` is held
 * by ADMIN too, which makes "an admin deactivates the last owner" a real path
 * rather than a hypothetical one.
 *
 * Pure on purpose: the caller does the counting, so this rule can be unit
 * tested without a database.
 */
export function assertNotLastOwner({
  targetRole,
  activeOwnerCount,
  action,
}: {
  targetRole: UserRole;
  /** Active owners *including* the target, if the target is active. */
  activeOwnerCount: number;
  /** Verb for the message, e.g. "demoted", "deactivated", "deleted". */
  action: string;
}): void {
  if (targetRole !== "OWNER") return;
  if (activeOwnerCount > 1) return;

  throw new ActionError(
    `This is the only active owner, so it cannot be ${action}. Make someone else an owner first.`,
  );
}
