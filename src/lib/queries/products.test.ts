import { describe, expect, it } from "vitest";

import { buildProductWhere } from "@/lib/queries/products";

describe("buildProductWhere", () => {
  it("returns an empty filter when nothing is selected", () => {
    expect(buildProductWhere({})).toEqual({});
  });

  it("searches name, SKU, part number and barcode", () => {
    const where = buildProductWhere({ q: "brake pad" });
    const clause = where.AND as Record<string, unknown>[];
    expect(clause).toHaveLength(1);
    const or = clause[0].OR as { [k: string]: unknown }[];
    expect(or.map((c) => Object.keys(c)[0])).toEqual([
      "name",
      "sku",
      "partNumber",
      "barcode",
    ]);
  });

  it("keeps BOTH clauses when searching inside a category", () => {
    // The regression this guards: assigning search and category to the same
    // `OR` key meant the category filter replaced the search term outright, so
    // searching within a category silently returned the whole category.
    const where = buildProductWhere({ q: "pad", categoryId: "cat_1" });
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses).toHaveLength(2);

    const searchClause = clauses.find((c) =>
      (c.OR as Record<string, unknown>[])?.some((x) => "name" in x),
    );
    const categoryClause = clauses.find((c) =>
      (c.OR as Record<string, unknown>[])?.some((x) => "categoryId" in x),
    );

    expect(searchClause, "search clause survived").toBeDefined();
    expect(categoryClause, "category clause survived").toBeDefined();
  });

  it("includes the category's children so a parent shows its subtree", () => {
    const where = buildProductWhere({ categoryId: "cat_brakes" });
    const clauses = where.AND as Record<string, unknown>[];
    expect(clauses[0].OR).toEqual([
      { categoryId: "cat_brakes" },
      { category: { parentId: "cat_brakes" } },
    ]);
  });

  it.each([
    ["active", true],
    ["inactive", false],
  ] as const)("maps status %s to isActive %s", (status, expected) => {
    const where = buildProductWhere({ status });
    expect(where.AND).toEqual([{ isActive: expected }]);
  });

  it.each([
    ["yes", true],
    ["no", false],
  ] as const)("maps review %s to needsReview %s", (review, expected) => {
    const where = buildProductWhere({ review });
    expect(where.AND).toEqual([{ needsReview: expected }]);
  });

  it("filters the review queue by a single importer flag", () => {
    const where = buildProductWhere({ flag: "no-price" });
    expect(where.AND).toEqual([
      { reviewReason: { contains: "no-price", mode: "insensitive" } },
    ]);
  });

  it("ignores a blank or whitespace-only search", () => {
    expect(buildProductWhere({ q: "   " })).toEqual({});
  });

  it("combines every filter at once", () => {
    const where = buildProductWhere({
      q: "pad",
      categoryId: "cat_1",
      status: "active",
      review: "yes",
      condition: "NEW",
      flag: "no-image",
    });
    expect(where.AND).toHaveLength(6);
  });
});
