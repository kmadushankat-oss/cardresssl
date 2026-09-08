import { describe, expect, it } from "vitest";

import type { BookingStatus } from "@/generated/prisma/enums";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONES,
  BOOKING_STATUSES,
  canTransition,
  isTerminal,
  nextStatuses,
} from "@/lib/booking-status";

describe("booking status transitions", () => {
  it("walks the normal path from pending to completed", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("lets a confirmed booking be completed without the in-progress step", () => {
    // A quick job is often just done and handed back.
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(true);
  });

  it("never moves a completed booking anywhere", () => {
    for (const to of BOOKING_STATUSES) {
      if (to === "COMPLETED") continue;
      expect(canTransition("COMPLETED", to), `COMPLETED → ${to}`).toBe(false);
    }
  });

  it("does not let a cancelled booking jump straight back into work", () => {
    expect(canTransition("CANCELLED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("CANCELLED", "COMPLETED")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("allows reopening a cancellation or no-show back to pending only", () => {
    expect(canTransition("CANCELLED", "PENDING")).toBe(true);
    expect(canTransition("NO_SHOW", "PENDING")).toBe(true);
  });

  it("does not let a pending booking skip to in-progress", () => {
    // It has to be confirmed first, so the diary is accurate.
    expect(canTransition("PENDING", "IN_PROGRESS")).toBe(false);
    expect(canTransition("PENDING", "COMPLETED")).toBe(false);
  });

  it("treats staying put as allowed, so re-saving a form is harmless", () => {
    for (const status of BOOKING_STATUSES) {
      expect(canTransition(status, status), status).toBe(true);
    }
  });

  it("reports COMPLETED as the only terminal status", () => {
    const terminal = BOOKING_STATUSES.filter(isTerminal);
    expect(terminal).toEqual(["COMPLETED"]);
  });

  it("never offers a transition that canTransition would refuse", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of nextStatuses(from)) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(true);
      }
    }
  });

  it("never offers a self-transition in the menu", () => {
    for (const from of BOOKING_STATUSES) {
      expect(nextStatuses(from)).not.toContain(from);
    }
  });
});

describe("booking status presentation", () => {
  it.each(BOOKING_STATUSES)("labels and tones %s", (status: BookingStatus) => {
    expect(BOOKING_STATUS_LABELS[status]).toBeTruthy();
    expect(BOOKING_STATUS_TONES[status]).toBeTruthy();
  });

  it("has no underscores left in a label", () => {
    for (const status of BOOKING_STATUSES) {
      expect(BOOKING_STATUS_LABELS[status]).not.toContain("_");
    }
  });
});
