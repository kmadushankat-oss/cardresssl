import type { BookingStatus } from "@/generated/prisma/enums";

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly BookingStatus[];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

export const BOOKING_STATUS_TONES: Record<
  BookingStatus,
  "warning" | "info" | "brand" | "success" | "danger" | "neutral"
> = {
  PENDING: "warning",
  CONFIRMED: "info",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
};

/**
 * Which status may follow which.
 *
 * Front-desk staff work fast, and a stray click should not be able to send a
 * completed job back to pending or resurrect a cancelled booking as
 * in-progress. `COMPLETED` is terminal; a cancellation or no-show can only be
 * reopened back to `PENDING`, which is a deliberate act rather than a slip.
 *
 * Lives outside the `"use server"` action file for two reasons: Next only
 * permits async exports from those, and a rule worth enforcing is worth
 * testing without a database.
 */
const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["PENDING"],
  NO_SHOW: ["PENDING"],
};

/** Staying put always counts as allowed, so re-saving a form is harmless. */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

/** The statuses a booking can move to right now, for building a menu. */
export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

export function isTerminal(status: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
