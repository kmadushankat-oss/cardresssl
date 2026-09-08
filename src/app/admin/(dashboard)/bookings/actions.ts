"use server";

import { z } from "zod";

import { ActionError, defineAction } from "@/lib/action";
import { revalidateBookings } from "@/lib/cache";
import { BOOKING_STATUSES, canTransition } from "@/lib/booking-status";
import { db } from "@/lib/db";

export const setBookingStatus = defineAction({
  permission: "booking:update",
  input: z.object({
    id: z.string().min(1),
    status: z.enum(BOOKING_STATUSES),
    cancelReason: z
      .string()
      .trim()
      .max(500)
      .transform((v) => (v === "" ? null : v))
      .optional(),
  }),
  audit: { action: "UPDATE", entity: "Booking" },
  handler: async ({ input, audit }) => {
    const booking = await db.booking.findUnique({
      where: { id: input.id },
      select: { bookingNumber: true, status: true, contactName: true },
    });
    if (!booking) throw new ActionError("That booking no longer exists");

    if (!canTransition(booking.status, input.status)) {
      throw new ActionError(
        `A ${booking.status.toLowerCase().replace("_", " ")} booking cannot be moved to ${input.status
          .toLowerCase()
          .replace("_", " ")}.`,
      );
    }

    const now = new Date();
    await db.booking.update({
      where: { id: input.id },
      data: {
        status: input.status,
        cancelReason: input.status === "CANCELLED" ? (input.cancelReason ?? null) : null,
        // Record when it was actually pencilled in, for the day view.
        scheduledAt: input.status === "CONFIRMED" ? now : undefined,
      },
    });

    audit({
      entityId: input.id,
      summary: `${booking.bookingNumber} (${booking.contactName}): ${booking.status} → ${input.status}`,
      changes: { status: { from: booking.status, to: input.status } },
    });

    revalidateBookings(input.id);
    return { bookingNumber: booking.bookingNumber, status: input.status };
  },
});

export const assignBooking = defineAction({
  permission: "booking:assign",
  input: z.object({
    id: z.string().min(1),
    assignedToId: z.string().transform((v) => (v === "" ? null : v)),
  }),
  audit: { action: "ASSIGN", entity: "Booking" },
  handler: async ({ input, audit }) => {
    if (input.assignedToId) {
      const staff = await db.user.findUnique({
        where: { id: input.assignedToId },
        select: { isActive: true, role: true, name: true },
      });
      if (!staff) throw new ActionError("That staff member no longer exists");
      if (!staff.isActive) {
        throw new ActionError(`${staff.name} is deactivated and cannot be assigned work.`);
      }
    }

    const booking = await db.booking.update({
      where: { id: input.id },
      data: { assignedToId: input.assignedToId },
      select: {
        bookingNumber: true,
        assignedTo: { select: { name: true } },
      },
    });

    audit({
      entityId: input.id,
      summary: booking.assignedTo
        ? `Assigned ${booking.bookingNumber} to ${booking.assignedTo.name}`
        : `Unassigned ${booking.bookingNumber}`,
    });

    revalidateBookings(input.id);
    return { bookingNumber: booking.bookingNumber };
  },
});

export const saveBookingNotes = defineAction({
  permission: "booking:update",
  input: z.object({
    id: z.string().min(1),
    internalNotes: z.string().trim().max(4000).transform((v) => (v === "" ? null : v)),
  }),
  audit: { action: "UPDATE", entity: "Booking" },
  handler: async ({ input, audit }) => {
    const booking = await db.booking.update({
      where: { id: input.id },
      data: { internalNotes: input.internalNotes },
      select: { bookingNumber: true },
    });

    audit({
      entityId: input.id,
      summary: `Updated internal notes on ${booking.bookingNumber}`,
    });

    revalidateBookings(input.id);
    return { bookingNumber: booking.bookingNumber };
  },
});
