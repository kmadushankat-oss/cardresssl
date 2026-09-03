import { db } from "@/lib/db";

export type SequenceKind =
  | "INVOICE"
  | "QUOTATION"
  | "BOOKING"
  | "JOBCARD"
  | "ORDER"
  | "CUSTOMER";

const PREFIXES: Record<SequenceKind, string> = {
  INVOICE: "INV",
  QUOTATION: "QUO",
  BOOKING: "BKG",
  JOBCARD: "JOB",
  ORDER: "ORD",
  CUSTOMER: "CUS",
};

/**
 * Allocate the next document number, e.g. `BKG-2026-0042`.
 *
 * Counters live in the `NumberSequence` table. The row is claimed with
 * `SELECT ... FOR UPDATE` inside a transaction, so two staff hitting "Save" in
 * the same second cannot be handed the same number.
 */
export async function nextNumber(
  kind: SequenceKind,
  opts: { year?: number } = {},
): Promise<string> {
  const year = opts.year ?? new Date().getFullYear();
  const key = `${kind}:${year}`;
  const prefix = PREFIXES[kind];

  const { n, padding } = await db.$transaction(async (tx) => {
    // Postgres locks the row for the rest of the transaction, serialising
    // concurrent allocations. Identifiers are quoted because Prisma keeps the
    // camelCase column names verbatim.
    const rows = await tx.$queryRaw<{ nextValue: number; padding: number }[]>`
      SELECT "nextValue", "padding"
      FROM "NumberSequence"
      WHERE "key" = ${key}
      FOR UPDATE
    `;

    if (rows.length === 0) {
      // First allocation for this kind/year.
      await tx.numberSequence.create({
        data: { key, prefix, nextValue: 2, padding: 4 },
      });
      return { n: 1, padding: 4 };
    }

    const current = rows[0];
    await tx.numberSequence.update({
      where: { key },
      data: { nextValue: current.nextValue + 1 },
    });
    return { n: current.nextValue, padding: current.padding };
  });

  return `${prefix}-${year}-${String(n).padStart(padding, "0")}`;
}

/** Unguessable token for the "view your invoice" link in emails. */
export function publicToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
