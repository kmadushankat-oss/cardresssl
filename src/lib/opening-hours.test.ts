import { describe, expect, it } from "vitest";

import {
  parseHoursRange,
  to24Hour,
  toOpeningHoursSpec,
} from "@/lib/opening-hours";

/*
 * A wrong opening time in Google is worse than no opening time: it sends a
 * customer to a closed workshop. So anything ambiguous must return null and be
 * omitted, never guessed.
 */

describe("to24Hour", () => {
  it.each([
    ["6:00 PM", "18:00"],
    ["6 PM", "18:00"],
    ["8:30 AM", "08:30"],
    ["8:30am", "08:30"],
    ["12:00 AM", "00:00"],
    ["12:00 PM", "12:00"],
    ["12 AM", "00:00"],
    ["18:00", "18:00"],
    ["9", "09:00"],
    ["5 p.m.", "17:00"],
  ])("reads %s as %s", (input, expected) => {
    expect(to24Hour(input)).toBe(expected);
  });

  it.each(["", "morning", "half five", "25:00", "8:75", "abc"])(
    "returns null for %s",
    (input) => {
      expect(to24Hour(input)).toBeNull();
    },
  );
});

describe("parseHoursRange", () => {
  it.each([
    ["8:30 AM - 6:00 PM", "08:30-18:00"],
    ["8:30 AM – 6:00 PM", "08:30-18:00"], // en dash
    ["8:30 AM — 6:00 PM", "08:30-18:00"], // em dash
    ["9am to 5pm", "09:00-17:00"],
    ["9 AM till 5 PM", "09:00-17:00"],
    ["08:30-17:00", "08:30-17:00"],
    ["8.30 AM - 5.00 PM".replace(/\./g, ":"), "08:30-17:00"],
  ])("reads %s as %s", (input, expected) => {
    expect(parseHoursRange(input)).toBe(expected);
  });

  it.each(["Closed", "closed", "CLOSED", "By appointment only"])(
    "treats %s as no hours",
    (input) => {
      expect(parseHoursRange(input)).toBeNull();
    },
  );

  it("returns null for a single time with no range", () => {
    expect(parseHoursRange("9:00 AM")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseHoursRange("")).toBeNull();
  });

  it("does not guess at prose", () => {
    expect(parseHoursRange("most days, ring first")).toBeNull();
  });
});

describe("toOpeningHoursSpec", () => {
  it("builds the schema.org spec from the real seeded defaults", () => {
    const spec = toOpeningHoursSpec({
      weekday: "8:30 AM - 6:00 PM",
      saturday: "8:30 AM - 5:00 PM",
      sunday: "Closed",
    });
    expect(spec).toEqual(["Mo-Fr 08:30-18:00", "Sa 08:30-17:00"]);
  });

  it("omits Sunday when it is closed rather than emitting a zero range", () => {
    const spec = toOpeningHoursSpec({
      weekday: "9am to 5pm",
      saturday: "Closed",
      sunday: "Closed",
    });
    expect(spec).toEqual(["Mo-Fr 09:00-17:00"]);
  });

  it("returns an empty array when nothing is set, so the field is dropped", () => {
    expect(toOpeningHoursSpec({ weekday: "", saturday: "", sunday: "" })).toEqual([]);
  });

  it("keeps the days it can read and drops the ones it cannot", () => {
    const spec = toOpeningHoursSpec({
      weekday: "8:30 AM - 6:00 PM",
      saturday: "ring first",
      sunday: "",
    });
    expect(spec).toEqual(["Mo-Fr 08:30-18:00"]);
  });
});
