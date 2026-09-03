/**
 * Create or update a staff account from the command line.
 *
 * Needed to bootstrap the first accounts before the Staff & roles screen
 * exists, and useful afterwards for resetting a forgotten password.
 *
 *   npx tsx scripts/create-staff.ts --email x@y.com --name "Nimal" --role MECHANIC
 *   npx tsx scripts/create-staff.ts --email x@y.com --password NewPass123! --reset-password
 *
 * Options:
 *   --email     required
 *   --name      display name (defaults to the local part of the email)
 *   --role      one of the UserRole values (default MECHANIC)
 *   --password  password to set (default: generated and printed)
 *   --reset-password  overwrite the password of an existing account
 */
import "dotenv/config";

import { UserRole } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { ROLE_LABELS } from "../src/lib/permissions";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function generatePassword(): string {
  // Readable but not guessable: enough entropy for a bootstrap credential the
  // user is told to change.
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const body = Buffer.from(bytes).toString("base64url");
  return `Cd-${body}1!`;
}

async function main() {
  const email = arg("email")?.toLowerCase().trim();
  if (!email) {
    console.error("Missing --email. See the comment at the top of this file.");
    process.exitCode = 1;
    return;
  }

  const roleInput = (arg("role") ?? "MECHANIC").toUpperCase();
  if (!(roleInput in UserRole)) {
    console.error(
      `Unknown role "${roleInput}". Valid roles: ${Object.keys(UserRole).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }
  const role = roleInput as keyof typeof UserRole;

  const name = arg("name") ?? email.split("@")[0];
  const password = arg("password") ?? generatePassword();
  const generated = !arg("password");

  const { hashPassword } = await import("better-auth/crypto");
  const { createLocalAccountIssuer } = await import("@better-auth/core/db");
  const issuer = createLocalAccountIssuer("credential");

  const existing = await db.user.findUnique({
    where: { email },
    include: { accounts: { where: { providerId: "credential" } } },
  });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { name, role, isActive: true },
    });

    const shouldSetPassword =
      existing.accounts.length === 0 || flag("reset-password");

    if (shouldSetPassword) {
      const hash = await hashPassword(password);
      if (existing.accounts.length === 0) {
        await db.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: existing.id,
            accountId: existing.id,
            providerId: "credential",
            issuer,
            password: hash,
          },
        });
      } else {
        await db.account.update({
          where: { id: existing.accounts[0].id },
          data: { password: hash },
        });
      }
    }

    console.log(`Updated ${email} — ${ROLE_LABELS[role]}`);
    if (shouldSetPassword && generated) console.log(`Password: ${password}`);
    else if (!shouldSetPassword) {
      console.log("Password unchanged (pass --reset-password to overwrite).");
    }
    return;
  }

  const userId = crypto.randomUUID();
  await db.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      role,
      isActive: true,
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          issuer,
          password: await hashPassword(password),
        },
      },
    },
  });

  console.log(`Created ${email} — ${ROLE_LABELS[role]}`);
  console.log(`Password: ${password}`);
  console.log("Ask them to change it after their first sign-in.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
