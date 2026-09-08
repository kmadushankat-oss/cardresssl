import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const auth = betterAuth({
  appName: "Car Dress SL",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: prismaAdapter(db, { provider: "mysql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day

    // Cookie caching is deliberately OFF. It would let a signed session carry
    // a stale `role` and `isActive` for the cache window, so revoking someone's
    // access or demoting them would not take effect immediately — unacceptable
    // for the thing that gates cost prices and staff management. The cost is one
    // session query per request, and `getSessionUser()` memoises that per
    // request via React `cache()`.
    cookieCache: { enabled: false },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CUSTOMER",
        // Never let a signup payload set its own role.
        input: false,
      },
      phone: { type: "string", required: false, input: true },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
      lastLoginAt: { type: "date", required: false, input: false },
    },
  },

  // The auth tables (`user`, `session`, `account`, `verification`) deliberately
  // have no Prisma id default — better-auth supplies the ids itself.

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          /*
           * Stamp the sign-in time.
           *
           * The Staff & roles screen shows when each person last signed in,
           * which is how the owner spots a dormant account worth deactivating.
           * Without this the column read "Never signed in" for everybody.
           *
           * Deliberately not awaited into the sign-in path's critical section,
           * and failures are swallowed: a bookkeeping write must never stop
           * someone logging in.
           */
          try {
            await db.user.update({
              where: { id: session.userId },
              data: { lastLoginAt: new Date() },
            });
          } catch (error) {
            console.error("[auth] could not record lastLoginAt", error);
          }
        },
      },
    },
  },

  // nextCookies() must stay last so it can wrap the response handlers.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
