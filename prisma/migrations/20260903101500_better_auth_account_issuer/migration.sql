-- better-auth 1.7 keys accounts on (issuer, accountId) rather than
-- (providerId, accountId), and requires a non-null `issuer` column.
--
-- Written by hand because `prisma migrate dev` cannot run non-interactively
-- when it wants to warn about adding a unique constraint. Safe to apply: the
-- `account` table is empty at this point, so the backfill below is a no-op in
-- practice and the new unique index cannot collide.

-- 1. Add the column, nullable to begin with so any existing rows survive.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

-- 2. Backfill. Pre-1.7 rows were all local credential accounts, whose issuer
--    is the application itself.
UPDATE "account" SET "issuer" = 'credential' WHERE "issuer" IS NULL;

-- 3. Now it can be NOT NULL.
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

-- 4. Replace the old uniqueness rule with the new one.
DROP INDEX IF EXISTS "account_providerId_accountId_key";
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
