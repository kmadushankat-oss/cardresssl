"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { revalidateBookings } from "@/lib/cache";
import { db } from "@/lib/db";
import {
  sendBookingReceivedEmail,
  sendStaffBookingAlert,
} from "@/lib/mail-templates";
import { nextNumber } from "@/lib/numbering";
import { getSettings } from "@/lib/settings";
import {
  publicBookingSchema,
  validateBookingDate,
  type PublicBookingInput,
} from "@/lib/validation/booking";

/**
 * Take a booking from the public site.
 *
 * Not built with `defineAction` — that requires a signed-in staff member with a
 * permission, and this is deliberately open to the public. So the protections
 * are written out here: a honeypot, a per-phone rate limit, strict validation,
 * and no trust in anything the form claims about prices or services.
 */
export async function submitBooking(
  input: PublicBookingInput,
): Promise<ActionResult<{ bookingNumber: string }>> {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return actionError(
      "Please check the highlighted fields.",
      flat.fieldErrors as Record<string, string[]>,
    );
  }

  const data = parsed.data;

  // The honeypot is validated as max-length 0, so reaching here means it was
  // empty. Nothing further to do.

  const settings = await getSettings();
  const leadTimeHours = Number.parseInt(settings["booking.leadTimeHours"] || "0", 10) || 0;

  const dateCheck = validateBookingDate(data.preferredDate, leadTimeHours);
  if (!dateCheck.ok) {
    return actionError(dateCheck.message, { preferredDate: [dateCheck.message] });
  }

  /*
   * Light rate limit. Someone hammering the form would otherwise fill the
   * workshop's inbox; three open requests from one number is already generous.
   */
  const recent = await db.booking.count({
    where: {
      contactPhone: data.contactPhone,
      status: { in: ["PENDING", "CONFIRMED"] },
      createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
    },
  });
  if (recent >= 3) {
    return actionError(
      "You already have several open booking requests. Please call us instead so we can help properly.",
    );
  }

  /*
   * Resolve the requested services against the database rather than trusting
   * the form. Slugs come from the client, so an unknown one is simply dropped —
   * a booking with no recognised service is still a booking worth having.
   */
  const services = data.serviceSlugs.length
    ? await db.service.findMany({
        where: { slug: { in: data.serviceSlugs }, isActive: true },
        select: { id: true, name: true },
      })
    : [];

  const bookingNumber = await nextNumber("BOOKING");

  const booking = await db.booking.create({
    data: {
      bookingNumber,
      status: "PENDING",
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      vehicleMake: data.vehicleMake,
      vehicleModel: data.vehicleModel,
      vehicleYear: data.vehicleYear,
      vehicleRegistration: data.vehicleRegistration,
      preferredDate: new Date(data.preferredDate),
      preferredTime: data.preferredTime,
      notes: data.notes,
      source: "WEBSITE",
      services: {
        create: services.map((service) => ({ serviceId: service.id })),
      },
    },
    select: { id: true, bookingNumber: true },
  });

  /*
   * Email is best-effort. A booking that is safely in the database must not be
   * reported as failed because Resend had a bad minute — the workshop can still
   * see it in the dashboard.
   */
  const serviceNames = services.map((s) => s.name);

  await Promise.allSettled([
    data.contactEmail
      ? sendBookingReceivedEmail({
          to: data.contactEmail,
          bookingNumber: booking.bookingNumber,
          name: data.contactName,
          preferredDate: data.preferredDate,
          preferredTime: data.preferredTime,
          serviceNames,
          settings,
        })
      : Promise.resolve(),
    sendStaffBookingAlert({
      bookingNumber: booking.bookingNumber,
      name: data.contactName,
      phone: data.contactPhone,
      preferredDate: data.preferredDate,
      preferredTime: data.preferredTime,
      serviceNames,
      vehicle: [data.vehicleMake, data.vehicleModel, data.vehicleYear?.toString()]
        .filter(Boolean)
        .join(" "),
      notes: data.notes,
      settings,
    }),
  ]);

  revalidateBookings();

  return actionOk({ bookingNumber: booking.bookingNumber });
}
