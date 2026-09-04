import { z } from "zod";

import { money, optionalMoney } from "@/lib/validation/product";

/** The vehicle size bands the workshop prices by. */
export const VEHICLE_CLASSES = [
  "CAR",
  "VAN",
  "SUV",
  "CAB",
  "LORRY",
  "MOTORCYCLE",
] as const;

export const VEHICLE_CLASS_LABELS: Record<(typeof VEHICLE_CLASSES)[number], string> = {
  CAR: "Car",
  VAN: "Van",
  SUV: "SUV",
  CAB: "Cab / Three-wheeler",
  LORRY: "Lorry / Truck",
  MOTORCYCLE: "Motorcycle",
};

const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());

/**
 * One row of the price matrix.
 *
 * A blank price means "we don't offer this service for that vehicle class",
 * and the row is removed rather than stored as zero — otherwise the site would
 * advertise a free SUV valet.
 */
const priceRow = z.object({
  vehicleClass: z.enum(VEHICLE_CLASSES),
  price: optionalMoney,
  durationMinutes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number.parseInt(v, 10)))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0), {
      message: "Enter a number of minutes",
    }),
});

export const serviceSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Give the service a name"),
    categoryId: z.string().transform(blankToNull),
    shortDescription: z.string().transform(blankToNull),
    description: z.string().transform(blankToNull),

    /** Used only when no vehicle-class price matches. */
    basePrice: optionalMoney,
    priceFrom: z.coerce.boolean(),
    durationMinutes: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number.parseInt(v, 10)))
      .refine((v) => v === null || (Number.isFinite(v) && v > 0), {
        message: "Enter a number of minutes",
      }),

    isActive: z.coerce.boolean(),
    isFeatured: z.coerce.boolean(),
    sortOrder: money.transform((v) => Number.parseInt(v, 10) || 0),

    prices: z.array(priceRow).max(VEHICLE_CLASSES.length),

    seoTitle: z.string().transform(blankToNull),
    seoDescription: z.string().transform(blankToNull),
  })
  .refine(
    (v) => v.basePrice !== null || v.prices.some((p) => p.price !== null),
    {
      // A service with no price at all cannot be shown or quoted.
      message: "Set either a base price or at least one vehicle-class price",
      path: ["basePrice"],
    },
  );

export type ServiceInput = z.input<typeof serviceSchema>;
export type ServiceOutput = z.output<typeof serviceSchema>;
