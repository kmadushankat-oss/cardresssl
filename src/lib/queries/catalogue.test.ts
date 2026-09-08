import { describe, expect, it } from "vitest";

import { buildCatalogueWhere } from "@/lib/queries/catalogue";

/** Pull the clause list out of the composed where. */
function clauses(where: ReturnType<typeof buildCatalogueWhere>) {
  return (where.AND ?? []) as Record<string, unknown>[];
}

describe("buildCatalogueWhere — what the public may see", () => {
  it("always restricts to active products with a real price", () => {
    // 261 imported rows are inactive or unpriced — invoice lines like
    // "Previous Balance" among them. None may ever reach the storefront.
    const base = clauses(buildCatalogueWhere({}))[0];
    expect(base).toEqual({ isActive: true, price: { gt: 0 } });
  });

  it("keeps that restriction no matter what else is filtered", () => {
    const where = buildCatalogueWhere({
      q: "brake",
      category: "brakes",
      brand: "denso",
      make: "Toyota",
      condition: "NEW",
      inStock: true,
    });
    expect(clauses(where)[0]).toEqual({ isActive: true, price: { gt: 0 } });
  });
});

describe("buildCatalogueWhere — search", () => {
  it("searches the part number, not just the name", () => {
    // A mechanic holding the old part searches by the number stamped on it.
    const search = clauses(buildCatalogueWhere({ q: "11532247154" })).find((c) => c.OR);
    const fields = (search?.OR as Record<string, unknown>[]).map(
      (c) => Object.keys(c)[0],
    );
    expect(fields).toContain("partNumber");
    expect(fields).toContain("sku");
    expect(fields).toContain("name");
  });

  it("ignores a whitespace-only query", () => {
    expect(clauses(buildCatalogueWhere({ q: "   " }))).toHaveLength(1);
  });
});

describe("buildCatalogueWhere — category", () => {
  it("matches a parent slug or a child's parent, so a top level shows its subtree", () => {
    const clause = clauses(buildCatalogueWhere({ category: "brakes" }))[1];
    expect(clause.OR).toEqual([
      { category: { slug: "brakes" } },
      { category: { parent: { slug: "brakes" } } },
    ]);
  });
});

describe("buildCatalogueWhere — vehicle fitment", () => {
  it("filters by make alone", () => {
    const clause = clauses(buildCatalogueWhere({ make: "Toyota" }))[1];
    expect(clause).toEqual({
      fitments: { some: { make: { equals: "Toyota", mode: "insensitive" } } },
    });
  });

  it("adds the model when one is chosen", () => {
    const clause = clauses(buildCatalogueWhere({ make: "Toyota", model: "Aqua" }))[1];
    const some = (clause.fitments as { some: Record<string, unknown> }).some;
    expect(some.model).toEqual({ equals: "Aqua", mode: "insensitive" });
  });

  it("ignores a model given without a make", () => {
    // Meaningless on its own, and would otherwise silently return nothing.
    expect(clauses(buildCatalogueWhere({ model: "Aqua" }))).toHaveLength(1);
  });

  it("matches a year inside the fitment range, allowing open ends", () => {
    /*
     * The subtle part. A fitment may record only a start year, only an end
     * year, or neither. Treating a missing bound as "no match" would hide most
     * of the catalogue; treating it as unbounded is correct.
     */
    const clause = clauses(buildCatalogueWhere({ make: "BMW", year: 2015 }))[1];
    const some = (clause.fitments as { some: { AND: Record<string, unknown>[] } }).some;

    expect(some.AND).toEqual([
      { OR: [{ yearFrom: null }, { yearFrom: { lte: 2015 } }] },
      { OR: [{ yearTo: null }, { yearTo: { gte: 2015 } }] },
    ]);
  });

  it("ignores a year given without a make", () => {
    expect(clauses(buildCatalogueWhere({ year: 2015 }))).toHaveLength(1);
  });
});

describe("buildCatalogueWhere — availability", () => {
  it("treats a product that does not track inventory as available", () => {
    // Inventory tracking is off for every imported product, because the old
    // site held no stock figures. Requiring stockQty > 0 would empty the shop.
    const clause = clauses(buildCatalogueWhere({ inStock: true }))[1];
    expect(clause.OR).toEqual([{ trackInventory: false }, { stockQty: { gt: 0 } }]);
  });
});

describe("buildCatalogueWhere — combinations", () => {
  it("applies every filter together", () => {
    const where = buildCatalogueWhere({
      q: "pad",
      category: "brakes",
      brand: "denso",
      condition: "NEW",
      make: "Toyota",
      model: "Aqua",
      year: 2015,
      inStock: true,
    });
    // base + search + category + brand + condition + inStock + fitment
    expect(clauses(where)).toHaveLength(7);
  });
});
