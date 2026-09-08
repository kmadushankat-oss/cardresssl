"use server";

import { z } from "zod";

import { ActionError, defineAction } from "@/lib/action";
import { revalidateUsers } from "@/lib/cache";
import { db } from "@/lib/db";
import { assertNotLastOwner } from "@/lib/guards";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/permissions";

const ROLE_VALUES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "SERVICE_ADVISOR",
  "MECHANIC",
  "STOREKEEPER",
  "CUSTOMER",
] as const;

/**
 * Look up what the last-owner rule needs, then apply it.
 *
 * The rule itself lives in `lib/guards.ts` and is pure, so it is unit tested
 * without a database; this only does the counting.
 */
async function guardLastOwner(userId: string, action: string) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target) return;

  const activeOwnerCount = await db.user.count({
    where: { role: "OWNER", isActive: true },
  });

  assertNotLastOwner({ targetRole: target.role, activeOwnerCount, action });
}

export const createStaffUser = defineAction({
  permission: "user:create",
  input: z.object({
    name: z.string().trim().min(2, "Enter their name"),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    phone: z.string().trim().transform((v) => (v === "" ? null : v)),
    role: z.enum(ROLE_VALUES),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "That is too long"),
  }),
  audit: { action: "CREATE", entity: "User" },
  handler: async ({ input, user, audit }) => {
    // Only an owner may mint another owner.
    if (input.role === "OWNER" && user.role !== "OWNER") {
      throw new ActionError("Only an owner can create another owner.", {
        role: ["Not allowed"],
      });
    }

    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ActionError("Someone already has that email address.", {
        email: ["Already in use"],
      });
    }

    const { hashPassword } = await import("better-auth/crypto");
    const { createLocalAccountIssuer } = await import("@better-auth/core/db");

    const id = crypto.randomUUID();
    await db.user.create({
      data: {
        id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        emailVerified: true,
        isActive: true,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: id,
            providerId: "credential",
            issuer: createLocalAccountIssuer("credential"),
            password: await hashPassword(input.password),
          },
        },
      },
    });

    audit({
      entityId: id,
      summary: `Created ${ROLE_LABELS[input.role]} account for ${input.email}`,
    });

    revalidateUsers();
    return { id, email: input.email };
  },
});

export const changeUserRole = defineAction({
  permission: "user:changeRole",
  input: z.object({ id: z.string().min(1), role: z.enum(ROLE_VALUES) }),
  audit: { action: "CHANGE_ROLE", entity: "User" },
  handler: async ({ input, user, audit }) => {
    if (input.id === user.id) {
      // Otherwise an owner can demote themselves out of user management.
      throw new ActionError("You cannot change your own role.");
    }

    const target = await db.user.findUnique({
      where: { id: input.id },
      select: { email: true, role: true },
    });
    if (!target) throw new ActionError("That account no longer exists");
    if (target.role === input.role) return { email: target.email, changed: false };

    if (target.role === "OWNER") await guardLastOwner(input.id, "demoted");

    await db.user.update({ where: { id: input.id }, data: { role: input.role } });

    audit({
      entityId: input.id,
      summary: `Changed ${target.email} from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[input.role]}`,
      changes: { role: { from: target.role, to: input.role } },
    });

    revalidateUsers();
    return { email: target.email, changed: true };
  },
});

export const setUserActive = defineAction({
  permission: "user:update",
  input: z.object({ id: z.string().min(1), isActive: z.boolean() }),
  audit: { action: "UPDATE", entity: "User" },
  handler: async ({ input, user, audit }) => {
    if (input.id === user.id && !input.isActive) {
      throw new ActionError("You cannot deactivate your own account.");
    }

    if (!input.isActive) await guardLastOwner(input.id, "deactivated");

    const target = await db.user.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
      select: { email: true },
    });

    /*
     * Drop their sessions as well. Session cookie caching is off, so the very
     * next request re-reads `isActive` — but deleting the session ends it
     * immediately rather than leaving them on a page that half works.
     */
    if (!input.isActive) {
      await db.session.deleteMany({ where: { userId: input.id } });
    }

    audit({
      entityId: input.id,
      summary: `${input.isActive ? "Reactivated" : "Deactivated"} ${target.email}`,
    });

    revalidateUsers();
    return { email: target.email };
  },
});

export const resetUserPassword = defineAction({
  permission: "user:update",
  input: z.object({
    id: z.string().min(1),
    password: z.string().min(8, "Use at least 8 characters").max(128),
  }),
  audit: { action: "RESET_PASSWORD", entity: "User" },
  handler: async ({ input, audit }) => {
    const target = await db.user.findUnique({
      where: { id: input.id },
      select: {
        email: true,
        accounts: { where: { providerId: "credential" }, select: { id: true } },
      },
    });
    if (!target) throw new ActionError("That account no longer exists");

    const { hashPassword } = await import("better-auth/crypto");
    const { createLocalAccountIssuer } = await import("@better-auth/core/db");
    const hash = await hashPassword(input.password);

    if (target.accounts.length > 0) {
      await db.account.update({
        where: { id: target.accounts[0].id },
        data: { password: hash },
      });
    } else {
      // No credential account yet — an interrupted sign-up. Repair it.
      await db.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: input.id,
          accountId: input.id,
          providerId: "credential",
          issuer: createLocalAccountIssuer("credential"),
          password: hash,
        },
      });
    }

    // Force them to sign in again with the new password.
    await db.session.deleteMany({ where: { userId: input.id } });

    audit({ entityId: input.id, summary: `Reset the password for ${target.email}` });

    revalidateUsers();
    return { email: target.email };
  },
});

export const deleteUser = defineAction({
  permission: "user:delete",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "DELETE", entity: "User" },
  handler: async ({ input, user, audit }) => {
    if (input.id === user.id) {
      throw new ActionError("You cannot delete your own account.");
    }
    await guardLastOwner(input.id, "deleted");

    const target = await db.user.findUnique({
      where: { id: input.id },
      select: { email: true, role: true },
    });
    if (!target) throw new ActionError("That account no longer exists");

    await db.user.delete({ where: { id: input.id } });

    audit({
      entityId: input.id,
      summary: `Deleted the ${ROLE_LABELS[target.role]} account ${target.email}`,
    });

    revalidateUsers();
    return { email: target.email };
  },
});

export const STAFF_ROLE_VALUES = STAFF_ROLES;
