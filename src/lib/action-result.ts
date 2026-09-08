/**
 * The result shape every server action returns, and the error type that
 * distinguishes a broken rule from a broken program.
 *
 * Deliberately dependency-free. These types used to live in `lib/action.ts`
 * alongside `defineAction`, which imports the session helpers and therefore
 * the validated environment — so a unit test for a pure rule could not import
 * `ActionError` without a DATABASE_URL. Anything that only needs the shapes
 * imports this instead.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * A rule the user broke, as opposed to a fault in the code.
 *
 * `defineAction` catches this and returns its message to the form; anything
 * else is rethrown so real bugs still reach the error boundary and the logs
 * instead of being shown to staff as if they had done something wrong.
 */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** What a handler passes to `audit()` to describe what it changed. */
export type AuditDetails = {
  entityId?: string | null;
  summary?: string;
  changes?: unknown;
};
