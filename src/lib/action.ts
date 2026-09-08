import { z } from "zod";

import {
  ActionError,
  actionError,
  actionOk,
  type ActionResult,
  type AuditDetails,
} from "@/lib/action-result";
import { recordAudit } from "@/lib/audit";
import type { Permission } from "@/lib/permissions";
import { can, isStaffRole } from "@/lib/permissions";
import { getSessionUser, type SessionUser } from "@/lib/session";

/*
 * Re-exported so callers keep importing everything action-related from one
 * place. The definitions live in `action-result.ts`, which has no imports of
 * its own — `defineAction` pulls in the session and therefore the validated
 * environment, and a unit test for a pure rule should not need a DATABASE_URL
 * just to construct an ActionError.
 */
export {
  ActionError,
  actionError,
  actionOk,
  type ActionResult,
  type AuditDetails,
};

/**
 * Static description of what an action does, for the audit log.
 *
 * Note there are no callbacks here. An earlier version took
 * `entityId: (result) => …` so the id could be read off the handler's return
 * value, but that made `TOutput` inferable from a position that only consumes
 * it — leaving the result typed `unknown` unless `handler` happened to be
 * written above `audit` in the object literal. An API whose type safety depends
 * on property order is a trap, so the handler now reports the specifics itself
 * via `audit()`, at the point where it actually knows them.
 */
type AuditSpec = {
  action: string;
  entity: string;
};


/*
 * Deliberately not extracted into a type alias.
 *
 * `NoInfer` only takes effect at the inference site, so behind an alias the
 * compiler still tried to infer `TOutput` from the audit callbacks as well as
 * from `handler`. Because those callbacks only *consume* the result, inference
 * collapsed to `unknown` and `(result) => result.id` stopped compiling.
 */

/**
 * Build a server action with authorization, validation and auditing applied
 * once, in one place.
 *
 * Every mutation in the admin goes through this. That is the point: a new
 * action cannot accidentally ship without a permission check, because there is
 * no way to declare one without naming a `Permission`.
 *
 * ```ts
 * export const updateProduct = defineAction({
 *   permission: "product:update",
 *   input: productSchema,
 *   audit: { action: "UPDATE", entity: "Product", entityId: (p) => p.id },
 *   handler: async ({ input }) => db.product.update({ ... }),
 * });
 * ```
 */
export function defineAction<TSchema extends z.ZodTypeAny, TOutput>(options: {
  /** Permission the caller must hold. */
  permission: Permission;
  /** Zod schema for the action's input. */
  input: TSchema;
  /** What kind of change this is. Omit for read-only actions. */
  audit?: AuditSpec;
  handler: (args: {
    input: z.output<TSchema>;
    user: SessionUser;
    /**
     * Record which record changed and what happened. Call it once the ids are
     * known; calling again replaces the earlier details.
     */
    audit: (details: AuditDetails) => void;
  }) => Promise<TOutput>;
}) {
  return async function run(
    rawInput: z.input<TSchema>,
  ): Promise<ActionResult<TOutput>> {
    // 1. Who is calling?
    const user = await getSessionUser();
    if (!user || !user.isActive) {
      return actionError("You are signed out. Please sign in again.");
    }
    if (!isStaffRole(user.role)) {
      return actionError("This account cannot access the admin dashboard.");
    }

    // 2. May they do this?
    if (!can(user.role, options.permission)) {
      return actionError("You do not have permission to do that.");
    }

    // 3. Is the input valid?
    const parsed = options.input.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      return actionError(
        "Please correct the highlighted fields.",
        flat.fieldErrors as Record<string, string[]>,
      );
    }

    // 4. Do the work. A broken business rule comes back as a message on the
    //    form; anything else is a genuine fault and is left to propagate.
    let details: AuditDetails = {};
    let result: TOutput;
    try {
      result = await options.handler({
        input: parsed.data,
        user,
        audit: (next) => {
          details = next;
        },
      });
    } catch (error) {
      if (error instanceof ActionError) {
        return actionError(error.message, error.fieldErrors);
      }
      throw error;
    }

    // 5. Leave a trail.
    if (options.audit) {
      await recordAudit({
        userId: user.id,
        action: options.audit.action,
        entity: options.audit.entity,
        entityId: details.entityId ?? null,
        summary: details.summary ?? null,
        changes: details.changes,
      });
    }

    return actionOk(result);
  };
}
