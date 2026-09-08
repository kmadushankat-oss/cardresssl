import { z } from "zod";

import { VEHICLE_CLASSES } from "@/lib/validation/service";

/**
 * Sri Lankan phone numbers, loosely.
 *
 * Accepts 0771234567, 077 123 4567, +94771234567 and 0112179595 — people type
 * all of these. Strict validation here loses real customers, so the rule is
 * only "enough digits to be dialable".
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(9, "Enter a phone number we can reach you on")
  .max(20)
  .refine((v) => v.replace(/\D/g, "").length >= 9, {
    message: "That does not look like a full phone number",
  });

const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Enter a valid email address, or leave it empty",
  });

const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());

/**
 * A booking request from the public site.
 *
 * Deliberately forgiving: a phone number and a date are the only things truly
 * required, because every extra mandatory field costs bookings. Everything else
 * can be sorted out when the workshop rings back.
 */
export const publicBookingSchema = z.object({
  contactName: z.string().trim().min(2, "Please give us your name").max(120),
  contactPhone: phoneSchema,
  contactEmail: optionalEmail,

  vehicleMake: z.string().trim().max(60).transform(blankToNull),
  vehicleModel: z.string().trim().max(60).transform(blankToNull),
  vehicleYear: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number.parseInt(v, 10)))
    .refine(
      (v) => v === null || (v >= 1950 && v <= new Date().getFullYear() + 1),
      { message: "Enter a real year" },
    ),
  vehicleRegistration: z.string().trim().max(20).transform(blankToNull),
  vehicleClass: z.enum(VEHICLE_CLASSES).optional(),

  serviceSlugs: z.array(z.string().min(1)).max(10).default([]),

  preferredDate: z
    .string()
    .trim()
    .min(1, "Choose a date")
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Choose a valid date" }),
  preferredTime: z.string().trim().max(20).transform(blankToNull),

  notes: z.string().trim().max(2000).transform(blankToNull),

  /**
   * Honeypot. Real people never see this field, so anything in it is a bot —
   * cheaper and less annoying than a CAPTCHA, which we are not allowed to make
   * customers solve anyway.
   */
  website: z.string().max(0).optional().default(""),
});

export type PublicBookingInput = z.input<typeof publicBookingSchema>;

/**
 * How far ahead a booking must be, and that it is not in the past.
 *
 * Kept separate from the schema so the lead time can come from settings rather
 * than being baked into the type.
 */
export function validateBookingDate(
  dateString: string,
  leadTimeHours: number,
): { ok: true } | { ok: false; message: string } {
  const requested = new Date(dateString);
  if (Number.isNaN(requested.getTime())) {
    return { ok: false, message: "Choose a valid date" };
  }

  // Compare whole days: a request for "today" is legitimate even at 4pm.
  const startOfRequested = new Date(requested);
  startOfRequested.setHours(0, 0, 0, 0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (startOfRequested < startOfToday) {
    return { ok: false, message: "That date has already passed" };
  }

  const earliest = new Date(Date.now() + leadTimeHours * 3_600_000);
  const startOfEarliest = new Date(earliest);
  startOfEarliest.setHours(0, 0, 0, 0);

  if (startOfRequested < startOfEarliest) {
    const hours = leadTimeHours;
    return {
      ok: false,
      message:
        hours >= 24
          ? `Please book at least ${Math.round(hours / 24)} day(s) ahead`
          : `Please book at least ${hours} hours ahead`,
    };
  }

  // A year out is a mistyped year, not a plan.
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() + 1);
  if (startOfRequested > latest) {
    return { ok: false, message: "That date is too far ahead" };
  }

  return { ok: true };
}
