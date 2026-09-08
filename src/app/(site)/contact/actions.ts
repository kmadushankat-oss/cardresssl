"use server";

import { z } from "zod";

import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { revalidateEnquiries } from "@/lib/cache";
import { db } from "@/lib/db";
import { sendEnquiryReceivedEmail, sendStaffEnquiryAlert } from "@/lib/mail-templates";
import { getSettings } from "@/lib/settings";
import { phoneSchema } from "@/lib/validation/booking";

const enquirySchema = z.object({
  name: z.string().trim().min(2, "Please give us your name").max(120),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address, or leave it empty",
    }),
  subject: z.string().trim().max(200).transform((v) => (v === "" ? null : v)),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more so we can help")
    .max(4000),
  /** Honeypot — see the booking form. */
  website: z.string().max(0).optional().default(""),
});

export type EnquiryInput = z.input<typeof enquirySchema>;

/** Contact form submission. Public, so it carries its own protections. */
export async function submitEnquiry(
  input: EnquiryInput,
): Promise<ActionResult<{ received: true }>> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return actionError(
      "Please check the highlighted fields.",
      flat.fieldErrors as Record<string, string[]>,
    );
  }

  const data = parsed.data;

  // Same reasoning as bookings: keep one person from flooding the inbox.
  const recent = await db.enquiry.count({
    where: {
      phone: data.phone,
      createdAt: { gte: new Date(Date.now() - 3_600_000) },
    },
  });
  if (recent >= 3) {
    return actionError(
      "We already have your recent messages. Please call us if it is urgent.",
    );
  }

  const settings = await getSettings();

  await db.enquiry.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      subject: data.subject,
      message: data.message,
      status: "NEW",
      source: "CONTACT_FORM",
    },
  });

  // Best-effort: the message is saved, so a mail hiccup must not look like a
  // failure to the customer.
  await Promise.allSettled([
    sendStaffEnquiryAlert({
      name: data.name,
      phone: data.phone,
      email: data.email,
      subject: data.subject,
      message: data.message,
      settings,
    }),
    data.email
      ? sendEnquiryReceivedEmail({ to: data.email, name: data.name, settings })
      : Promise.resolve(),
  ]);

  revalidateEnquiries();

  return actionOk({ received: true });
}
