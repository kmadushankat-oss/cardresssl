import { z } from "zod";

/**
 * Product form validation.
 *
 * Kept out of the `"use server"` action file so it can be unit tested — the
 * blank-to-zero conversions below exist because of a real failure and are
 * worth locking down.
 */

/**
 * Accepts "", "1200" and "1,200.50" — a price field people paste into.
 *
 * Blank becomes "0", not "". `price`, `costPrice` and `taxRate` are NOT NULL
 * Decimal columns and Prisma rejects an empty string outright ("Failed to
 * parse empty string. Expected decimal String"), which is exactly what a blank
 * Cost price produced.
 */
export const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/,/g, ""))
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter an amount like 1200 or 1200.50",
  })
  .transform((v) => (v === "" ? "0" : v));

/** For the nullable `discountedPrice`, where blank means "no promotion". */
export const optionalMoney = z
  .string()
  .trim()
  .transform((v) => v.replace(/,/g, ""))
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Enter an amount like 1200 or 1200.50",
  })
  .transform((v) => (v === "" ? null : v));

/** For nullable Int columns — blank clears the value. */
export const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number.parseInt(v, 10)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
    message: "Enter a whole number of 0 or more",
  });

/**
 * For non-nullable Int columns like `stockQty`. Blank means the fallback, not
 * null — writing null to a NOT NULL column fails at the database.
 */
export const intWithDefault = (fallback: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? fallback : Number.parseInt(v, 10)))
    .refine((v) => Number.isFinite(v) && v >= 0, {
      message: "Enter a whole number of 0 or more",
    });

const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());

export const productSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Give the product a name"),
    sku: z
      .string()
      .trim()
      .min(1, "A SKU is required")
      .max(64)
      .regex(/^[A-Za-z0-9._\-/]+$/, "Use letters, numbers, dots, dashes or slashes"),
    partNumber: z.string().transform(blankToNull),
    barcode: z.string().transform(blankToNull),
    categoryId: z.string().transform(blankToNull),
    brandId: z.string().transform(blankToNull),
    shortDescription: z.string().transform(blankToNull),
    description: z.string().transform(blankToNull),

    costPrice: money,
    price: money,
    discountedPrice: optionalMoney,
    taxRate: money,

    trackInventory: z.coerce.boolean(),
    stockQty: intWithDefault(0),
    lowStockThreshold: intWithDefault(5),

    condition: z.enum(["NEW", "USED", "REFURBISHED", "OEM", "AFTERMARKET"]),
    warrantyMonths: optionalInt,
    weightGrams: optionalInt,

    isActive: z.coerce.boolean(),
    isFeatured: z.coerce.boolean(),
    /** Clearing this is how a reviewer marks the row done. */
    needsReview: z.coerce.boolean(),

    seoTitle: z.string().transform(blankToNull),
    seoDescription: z.string().transform(blankToNull),
  })
  .refine(
    (v) =>
      v.discountedPrice === null ||
      Number.parseFloat(v.discountedPrice) < Number.parseFloat(v.price || "0"),
    {
      // Otherwise the storefront shows a "discount" that costs more.
      message: "The discounted price must be below the normal price",
      path: ["discountedPrice"],
    },
  );

export type ProductInput = z.input<typeof productSchema>;
export type ProductOutput = z.output<typeof productSchema>;
