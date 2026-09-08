import { describe, expect, it } from "vitest";

import {
  phoneSchema,
  publicBookingSchema,
  validateBookingDate,
  type PublicBookingInput,
} from "@/lib/validation/booking";

function form(overrides: Partial<PublicBookingInput> = {}): PublicBookingInput {
  return {
    contactName: "Kalana Perera",
    contactPhone: "077 123 4567",
    contactEmail: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    vehicleRegistration: "",
    serviceSlugs: [],
    preferredDate: "2026-12-01",
    preferredTime: "",
    notes: "",
    website: "",
    ...overrides,
  };
}

describe("phoneSchema — real numbers people type", () => {
  it.each([
    "0771234567",
    "077 123 4567",
    "+94771234567",
    "+94 77 123 4567",
    "011 2 179 595",
    "0112179595",
  ])("accepts %s", (value) => {
    expect(phoneSchema.safeParse(value).success, value).toBe(true);
  });

  it.each(["", "12345", "abc", "07712"])("rejects %s", (value) => {
    expect(phoneSchema.safeParse(value).success, value).toBe(false);
  });
});

describe("publicBookingSchema", () => {
  it("accepts a minimal booking — name, phone and a date", () => {
    // Every extra required field costs real bookings, so this must stay valid.
    const result = publicBookingSchema.safeParse(form());
    expect(result.success).toBe(true);
  });

  it("requires a name", () => {
    expect(publicBookingSchema.safeParse(form({ contactName: "" })).success).toBe(false);
  });

  it("requires a date", () => {
    expect(publicBookingSchema.safeParse(form({ preferredDate: "" })).success).toBe(false);
  });

  it("treats a blank email as null rather than an empty string", () => {
    const parsed = publicBookingSchema.parse(form({ contactEmail: "" }));
    expect(parsed.contactEmail).toBeNull();
  });

  it("rejects a malformed email but allows none at all", () => {
    expect(publicBookingSchema.safeParse(form({ contactEmail: "nope" })).success).toBe(
      false,
    );
    expect(publicBookingSchema.safeParse(form({ contactEmail: "" })).success).toBe(true);
  });

  it("parses the vehicle year, and rejects a nonsense one", () => {
    expect(publicBookingSchema.parse(form({ vehicleYear: "2015" })).vehicleYear).toBe(
      2015,
    );
    expect(publicBookingSchema.safeParse(form({ vehicleYear: "1066" })).success).toBe(
      false,
    );
    expect(publicBookingSchema.parse(form({ vehicleYear: "" })).vehicleYear).toBeNull();
  });

  it("rejects a submission with anything in the honeypot", () => {
    // Invisible to people; only a bot fills it in.
    expect(
      publicBookingSchema.safeParse(form({ website: "http://spam.example" })).success,
    ).toBe(false);
  });

  it("caps the number of services so the form cannot be abused", () => {
    const many = Array.from({ length: 11 }, (_, i) => `service-${i}`);
    expect(publicBookingSchema.safeParse(form({ serviceSlugs: many })).success).toBe(
      false,
    );
  });
});

describe("validateBookingDate", () => {
  const isoDaysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it("rejects a date in the past", () => {
    const result = validateBookingDate(isoDaysFromNow(-1), 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/already passed/i);
  });

  it("allows today when there is no lead time", () => {
    // Someone standing in the workshop at 4pm asking for today is legitimate.
    expect(validateBookingDate(isoDaysFromNow(0), 0).ok).toBe(true);
  });

  it("enforces a lead time in days", () => {
    const result = validateBookingDate(isoDaysFromNow(0), 48);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/2 day/);
  });

  it("phrases a sub-day lead time in hours", () => {
    const result = validateBookingDate(isoDaysFromNow(0), 4);
    // 4 hours ahead still lands today, so today remains bookable.
    expect(result.ok).toBe(true);
  });

  it("accepts a date comfortably beyond the lead time", () => {
    expect(validateBookingDate(isoDaysFromNow(7), 24).ok).toBe(true);
  });

  it("rejects a date more than a year out as a typo", () => {
    const result = validateBookingDate(isoDaysFromNow(400), 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/too far ahead/i);
  });

  it("rejects an unparseable date", () => {
    expect(validateBookingDate("not-a-date", 0).ok).toBe(false);
  });
});
