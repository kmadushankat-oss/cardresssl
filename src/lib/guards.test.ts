import { describe, expect, it } from "vitest";

import { ActionError } from "@/lib/action-result";
import { assertNotLastOwner } from "@/lib/guards";

/*
 * This rule is the difference between a recoverable mistake and having to open
 * the production database by hand. `user:changeRole` is OWNER-only, so once the
 * last owner is gone the role can never be granted again — and `user:update`
 * is held by ADMIN too, which makes "an admin deactivates the last owner" a
 * real path rather than a hypothetical one.
 */

describe("assertNotLastOwner", () => {
  it("blocks demoting the only active owner", () => {
    expect(() =>
      assertNotLastOwner({
        targetRole: "OWNER",
        activeOwnerCount: 1,
        action: "demoted",
      }),
    ).toThrow(ActionError);
  });

  it("blocks an admin deactivating the only active owner", () => {
    expect(() =>
      assertNotLastOwner({
        targetRole: "OWNER",
        activeOwnerCount: 1,
        action: "deactivated",
      }),
    ).toThrow(/only active owner/i);
  });

  it("blocks deleting the only active owner", () => {
    expect(() =>
      assertNotLastOwner({
        targetRole: "OWNER",
        activeOwnerCount: 1,
        action: "deleted",
      }),
    ).toThrow(/deleted/);
  });

  it("names the action in the message so the UI can show it verbatim", () => {
    try {
      assertNotLastOwner({
        targetRole: "OWNER",
        activeOwnerCount: 1,
        action: "demoted",
      });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError);
      expect((error as ActionError).message).toContain("demoted");
      expect((error as ActionError).message).toContain("Make someone else an owner");
    }
  });

  it("allows it when another owner remains", () => {
    expect(() =>
      assertNotLastOwner({
        targetRole: "OWNER",
        activeOwnerCount: 2,
        action: "demoted",
      }),
    ).not.toThrow();
  });

  it.each(["ADMIN", "MANAGER", "ACCOUNTANT", "MECHANIC", "CUSTOMER"] as const)(
    "does not restrict a %s at all",
    (role) => {
      expect(() =>
        assertNotLastOwner({
          targetRole: role,
          activeOwnerCount: 1,
          action: "deleted",
        }),
      ).not.toThrow();
    },
  );

  it("treats a count of zero as still protected", () => {
    // Should not be reachable, but failing open here would be the worst
    // possible direction to get wrong.
    expect(() =>
      assertNotLastOwner({
        targetRole: "OWNER",
        activeOwnerCount: 0,
        action: "deleted",
      }),
    ).toThrow(ActionError);
  });
});
