import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * A single PrismaClient across hot reloads — otherwise `next dev` opens a new
 * connection pool on every edit and Postgres runs out of connections.
 *
 * Prisma 7 requires an explicit driver adapter. `PrismaPg` talks plain
 * Postgres, which covers both the local docker-compose database and Neon's
 * pooled connection string in production.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Serverless functions are short-lived and numerous; a small pool per
    // instance keeps us well inside Neon's connection limit.
    max: process.env.NODE_ENV === "production" ? 5 : 10,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
