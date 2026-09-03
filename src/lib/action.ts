import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import type { Permission } from "@/lib/permissions";
import { can, isStaffRole } from "@/lib/permissions";
import { getSessionUser, type SessionUser } from "@/lib/session";

/**
 * The shape every server action returns.
 *
 * Actions resolve to a result object rather than throwing, so forms can render
 * field errors inline. Genuine faults (a dropped database connection) still
 * throw and hit the error boundary.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /** Per-field messages keyed by form field name, for inline display. */
      fieldErrors?: Record<string, string[]>;
    };

export function actionOk(): ActionResult<void>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

export function actionError(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

type AuditSpec<TInput, TOutput> = {
  action: string;
  entity: string;
  entityId?: (result: TOutput, input: TInput) => string | null | undefined;
  summary?: (result: TOutput, input: TInput) => string;
};

type DefineActionOptions<TSchema extends z.ZodTypeAny, TOutput> = {
  /** Permission the caller must hold. */
  permission: Permission;
  /** Zod schema for the action's input. */
  input: TSchema;
  /** What to write to the audit log on success. Omit for read-only actions. */
  audit?: AuditSpec<z.output<TSchema>, TOutput>;
  handler: (args: {
    input: z.output<TSchema>;
    user: SessionUser;
  }) => Promise<TOutput>;
};

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
export function defineAction<TSchema extends z.ZodTypeAny, TOutput>(
  options: DefineActionOptions<TSchema, TOutput>,
) {
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

    // 4. Do the work.
    const result = await options.handler({ input: parsed.data, user });

    // 5. Leave a trail.
    if (options.audit) {
      const { action, entity, entityId, summary } = options.audit;
      await recordAudit({
        userId: user.id,
        action,
        entity,
        entityId: entityId?.(result, parsed.data) ?? null,
        summary: summary?.(result, parsed.data) ?? null,
      });
    }

    return actionOk(result);
  };
}
