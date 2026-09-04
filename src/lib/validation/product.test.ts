import { describe, expect, it } from "vitest";

import { productSchema, type ProductInput } from "@/lib/validation/product";

function form(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Front Brake Pad Set",
    sku: "CD-BRAPAD-1",
    partNumber: "",
    barcode: "",
    categoryId: "",
    brandId: "",
    shortDescription: "",
    description: "",
    costPrice: "",
    price: "14500",
    discountedPrice: "",
    taxRate: "",
    trackInventory: false,
    stockQty: "",
    lowStockThreshold: "",
    condition: "NEW",
    warrantyMonths: "",
    weightGrams: "",
    isActive: true,
    isFeatured: false,
    needsReview: false,
    seoTitle: "",
    seoDescription: "",
    ...overrides,
  };
}

describe("productSchema — blank numeric fields", () => {
  /*
   * The regression these guard: `price`, `costPrice` and `taxRate` are NOT NULL
   * Decimal columns, and an empty string reached Prisma as "" — which it
   * rejects with "Failed to parse empty string. Expected decimal String". A
   * blank Cost price therefore 500'd on save.
   */
  it("turns a blank cost price into 0, never an empty string", () => {
    const parsed = productSchema.parse(form({ costPrice: "" }));
    expect(parsed.costPrice).toBe("0");
  });

  it("turns a blank tax rate into 0", () => {
    expect(productSchema.parse(form({ taxRate: "" })).taxRate).toBe("0");
  });

  it("turns a blank price into 0", () => {
    expect(productSchema.parse(form({ price: "" })).price).toBe("0");
  });

  it("never yields an empty string for any Decimal column", () => {
    const parsed = productSchema.parse(form());
    for (const key of ["price", "costPrice", "taxRate"] as const) {
      expect(parsed[key], key).not.toBe("");
    }
  });

  it("turns a blank stock quantity into 0, not null", () => {
    const parsed = productSchema.parse(form({ stockQty: "" }));
    expect(parsed.stockQty).toBe(0);
  });

  it("defaults a blank low-stock threshold to 5", () => {
    expect(productSchema.parse(form({ lowStockThreshold: "" })).lowStockThreshold).toBe(5);
  });

  it("leaves a blank discounted price as null — that column is nullable", () => {
    expect(productSchema.parse(form({ discountedPrice: "" })).discountedPrice).toBeNull();
  });

  it("leaves blank nullable ints as null", () => {
    const parsed = productSchema.parse(form({ warrantyMonths: "", weightGrams: "" }));
    expect(parsed.warrantyMonths).toBeNull();
    expect(parsed.weightGrams).toBeNull();
  });
});

describe("productSchema — money parsing", () => {
  it("strips thousands separators people paste in", () => {
    expect(productSchema.parse(form({ price: "1,200.50" })).price).toBe("1200.50");
  });

  it.each(["abc", "12.345", "-5", "1 200"])("rejects %s", (value) => {
    const result = productSchema.safeParse(form({ price: value }));
    expect(result.success).toBe(false);
  });

  it("accepts a whole number and two decimal places", () => {
    expect(productSchema.parse(form({ price: "1200" })).price).toBe("1200");
    expect(productSchema.parse(form({ price: "1200.50" })).price).toBe("1200.50");
  });
});

describe("productSchema — discount rule", () => {
  it("rejects a discount above the normal price", () => {
    const result = productSchema.safeParse(
      form({ price: "14500", discountedPrice: "99999" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path).toEqual(["discountedPrice"]);
  });

  it("rejects a discount equal to the normal price", () => {
    const result = productSchema.safeParse(
      form({ price: "14500", discountedPrice: "14500" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a discount below the normal price", () => {
    const result = productSchema.safeParse(
      form({ price: "14500", discountedPrice: "11999.50" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("productSchema — identity", () => {
  it("requires a name of at least two characters", () => {
    expect(productSchema.safeParse(form({ name: "x" })).success).toBe(false);
  });

  it("requires a SKU", () => {
    expect(productSchema.safeParse(form({ sku: "" })).success).toBe(false);
  });

  it("rejects a SKU with spaces or punctuation that breaks URLs", () => {
    for (const sku of ["A B", "A#1", "A,1"]) {
      expect(productSchema.safeParse(form({ sku })).success, sku).toBe(false);
    }
  });

  it("accepts the SKU shape the importer generates", () => {
    expect(productSchema.safeParse(form({ sku: "CD-HIQBRA-127" })).success).toBe(true);
  });

  it("turns blank optional text into null rather than empty strings", () => {
    const parsed = productSchema.parse(form());
    expect(parsed.partNumber).toBeNull();
    expect(parsed.categoryId).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("trims surrounding whitespace from the name", () => {
    expect(productSchema.parse(form({ name: "  Brake Pad  " })).name).toBe("Brake Pad");
  });
});
