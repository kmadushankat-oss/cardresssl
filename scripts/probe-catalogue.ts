/**
 * Ad-hoc probe for the public catalogue queries.
 *
 *   npx tsx scripts/probe-catalogue.ts
 *
 * Exercises the real filters against the real imported data, which is the only
 * way to be sure the storefront hides what it should and finds what it should.
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { listCatalogue, type CatalogueParams } from "../src/lib/queries/catalogue";

const cases: [string, CatalogueParams][] = [
  ["all sellable", {}],
  ["category=brakes", { category: "brakes" }],
  ["q=pad", { q: "pad" }],
  ["category=brakes + q=pad", { category: "brakes", q: "pad" }],
  ["q=zzzznothing", { q: "zzzznothing" }],
  ["condition=OEM", { condition: "OEM" }],
  ["make=Toyota", { make: "Toyota" }],
  ["sort=price-asc", { sort: "price-asc" }],
  ["sort=price-desc", { sort: "price-desc" }],
];

async function main() {
  for (const [label, params] of cases) {
    const result = await listCatalogue(params);
    const first = result.items[0];
    const detail = first ? `${first.name.slice(0, 34)} @ Rs.${first.price}` : "(none)";
    console.log(String(result.total).padStart(5), label.padEnd(26), detail);
  }

  const hidden = await db.product.count({
    where: { OR: [{ isActive: false }, { price: { lte: 0 } }] },
  });
  const junk = await db.product.count({
    where: { reviewReason: { contains: "not-a-product" } },
  });
  const visibleJunk = await db.product.count({
    where: {
      reviewReason: { contains: "not-a-product" },
      isActive: true,
      price: { gt: 0 },
    },
  });

  console.log("");
  console.log(`hidden from the storefront : ${hidden}`);
  console.log(`flagged as not-a-product   : ${junk}`);
  console.log(`...of which are VISIBLE    : ${visibleJunk}  (must be 0)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
