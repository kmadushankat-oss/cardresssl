import { describe, expect, it } from "vitest";

import {
  serviceSchema,
  VEHICLE_CLASS_LABELS,
  VEHICLE_CLASSES,
  type ServiceInput,
} from "@/lib/validation/service";

function form(overrides: Partial<ServiceInput> = {}): ServiceInput {
  return {
    name: "Cut & Polish",
    categoryId: "",
    shortDescription: "",
    description: "",
    basePrice: "",
    priceFrom: true,
    durationMinutes: "",
    isActive: true,
    isFeatured: false,
    sortOrder: "0",
    seoTitle: "",
    seoDescription: "",
    prices: [
      { vehicleClass: "CAR", price: "12000", durationMinutes: "" },
      { vehicleClass: "VAN", price: "", durationMinutes: "" },
      { vehicleClass: "SUV", price: "14500", durationMinutes: "" },
    ],
    ...overrides,
  };
}

describe("serviceSchema — the price matrix", () => {
  it("keeps a blank vehicle price as null so the row can be deleted, not zeroed", () => {
    // Storing 0 would advertise the job as free for that vehicle class.
    const parsed = serviceSchema.parse(form());
    const van = parsed.prices.find((p) => p.vehicleClass === "VAN");
    expect(van?.price).toBeNull();
  });

  it("carries through the prices that were filled in", () => {
    const parsed = serviceSchema.parse(form());
    const filled = parsed.prices.filter((p) => p.price !== null);
    expect(filled.map((p) => [p.vehicleClass, p.price])).toEqual([
      ["CAR", "12000"],
      ["SUV", "14500"],
    ]);
  });

  it("accepts a per-class duration", () => {
    const parsed = serviceSchema.parse(
      form({
        prices: [{ vehicleClass: "CAB", price: "5000", durationMinutes: "90" }],
      }),
    );
    expect(parsed.prices[0].durationMinutes).toBe(90);
  });

  it("rejects a service with no price anywhere", () => {
    const result = serviceSchema.safeParse(
      form({
        basePrice: "",
        prices: VEHICLE_CLASSES.map((vc) => ({
          vehicleClass: vc,
          price: "",
          durationMinutes: "",
        })),
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path).toEqual(["basePrice"]);
  });

  it("accepts a base price with no per-class prices", () => {
    const result = serviceSchema.safeParse(
      form({
        basePrice: "3500",
        prices: VEHICLE_CLASSES.map((vc) => ({
          vehicleClass: vc,
          price: "",
          durationMinutes: "",
        })),
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts per-class prices with no base price", () => {
    expect(serviceSchema.safeParse(form({ basePrice: "" })).success).toBe(true);
  });

  it("rejects a malformed price", () => {
    const result = serviceSchema.safeParse(
      form({
        prices: [{ vehicleClass: "CAR", price: "twelve thousand", durationMinutes: "" }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a zero-minute duration", () => {
    const result = serviceSchema.safeParse(
      form({ prices: [{ vehicleClass: "CAR", price: "500", durationMinutes: "0" }] }),
    );
    expect(result.success).toBe(false);
  });
});

describe("vehicle classes", () => {
  it("labels every class", () => {
    for (const vc of VEHICLE_CLASSES) {
      expect(VEHICLE_CLASS_LABELS[vc], vc).toBeTruthy();
    }
  });

  it("covers the sizes the old catalogue priced by", () => {
    // Car / Van / SUV are the three the WooCommerce products used.
    expect(VEHICLE_CLASSES).toContain("CAR");
    expect(VEHICLE_CLASSES).toContain("VAN");
    expect(VEHICLE_CLASSES).toContain("SUV");
  });
});
