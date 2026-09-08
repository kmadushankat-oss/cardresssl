"use server";

import { z } from "zod";

import { ActionError, defineAction } from "@/lib/action";
import { revalidateEnquiries } from "@/lib/cache";
import { db } from "@/lib/db";

const ENQUIRY_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "RESPONDED",
  "CLOSED",
  "SPAM",
] as const;

export const setEnquiryStatus = defineAction({
  permission: "enquiry:manage",
  input: z.object({
    id: z.string().min(1),
    status: z.enum(ENQUIRY_STATUSES),
  }),
  audit: { action: "UPDATE", entity: "Enquiry" },
  handler: async ({ input, user, audit }) => {
    const enquiry = await db.enquiry.update({
      where: { id: input.id },
      data: {
        status: input.status,
        // Stamp the reply time when it is first marked as responded.
        respondedAt: input.status === "RESPONDED" ? new Date() : undefined,
        // Picking something up claims it, so two people do not both reply.
        assignedToId:
          input.status === "IN_PROGRESS" ? user.id : undefined,
      },
      select: { name: true, status: true },
    });

    audit({
      entityId: input.id,
      summary: `Enquiry from ${enquiry.name} marked ${input.status}`,
    });

    revalidateEnquiries();
    return { name: enquiry.name, status: enquiry.status };
  },
});

export const saveEnquiryNotes = defineAction({
  permission: "enquiry:manage",
  input: z.object({
    id: z.string().min(1),
    internalNotes: z
      .string()
      .trim()
      .max(4000)
      .transform((v) => (v === "" ? null : v)),
  }),
  audit: { action: "UPDATE", entity: "Enquiry" },
  handler: async ({ input, audit }) => {
    const enquiry = await db.enquiry.update({
      where: { id: input.id },
      data: { internalNotes: input.internalNotes },
      select: { name: true },
    });

    audit({ entityId: input.id, summary: `Updated notes on the enquiry from ${enquiry.name}` });

    revalidateEnquiries();
    return { name: enquiry.name };
  },
});

export const deleteEnquiry = defineAction({
  permission: "enquiry:manage",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "DELETE", entity: "Enquiry" },
  handler: async ({ input, audit }) => {
    const enquiry = await db.enquiry.findUnique({
      where: { id: input.id },
      select: { name: true, status: true },
    });
    if (!enquiry) throw new ActionError("That enquiry no longer exists");

    /*
     * Only junk is deletable. A real enquiry is a record of a customer asking
     * for something, so it gets closed rather than destroyed — otherwise the
     * quickest way to clear the inbox is to erase the evidence.
     */
    if (enquiry.status !== "SPAM") {
      throw new ActionError(
        "Only enquiries marked as spam can be deleted. Mark it closed instead to keep the record.",
      );
    }

    await db.enquiry.delete({ where: { id: input.id } });

    audit({ entityId: input.id, summary: `Deleted a spam enquiry from ${enquiry.name}` });

    revalidateEnquiries();
    return { name: enquiry.name };
  },
});
