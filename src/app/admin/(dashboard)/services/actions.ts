"use server";

import { z } from "zod";

import { ActionError, defineAction } from "@/lib/action";
import { revalidateServices } from "@/lib/cache";
import { db } from "@/lib/db";
import { uniqueSlug } from "@/lib/utils";
import { serviceSchema } from "@/lib/validation/service";

export type { ServiceInput } from "@/lib/validation/service";

export const saveService = defineAction({
  permission: "service:manage",
  input: serviceSchema,
  audit: { action: "UPDATE", entity: "Service" },
  handler: async ({ input, audit }) => {
    const { id, prices, ...fields } = input;

    const clash = await db.service.findFirst({
      where: { name: fields.name, ...(id ? { id: { not: id } } : {}) },
      select: { name: true },
    });
    if (clash) {
      throw new ActionError(`A service called "${clash.name}" already exists`, {
        name: ["That name is already used"],
      });
    }

    const service = id
      ? await db.service.update({ where: { id }, data: fields })
      : await db.service.create({
          data: {
            ...fields,
            slug: await uniqueSlug(fields.name, async (slug) =>
              Boolean(
                await db.service.findUnique({ where: { slug }, select: { id: true } }),
              ),
            ),
          },
        });

    /*
     * Reconcile the price matrix.
     *
     * A blank price means the service is not offered for that vehicle class,
     * so the row is deleted rather than written as zero — a stored 0 would
     * advertise the job as free.
     */
    const supplied = prices.filter((p) => p.price !== null);
    const suppliedClasses = supplied.map((p) => p.vehicleClass);

    await db.servicePrice.deleteMany({
      where: {
        serviceId: service.id,
        ...(suppliedClasses.length
          ? { vehicleClass: { notIn: suppliedClasses } }
          : {}),
      },
    });

    for (const row of supplied) {
      await db.servicePrice.upsert({
        where: {
          serviceId_vehicleClass: {
            serviceId: service.id,
            vehicleClass: row.vehicleClass,
          },
        },
        create: {
          serviceId: service.id,
          vehicleClass: row.vehicleClass,
          price: row.price!,
          durationMinutes: row.durationMinutes,
        },
        update: {
          price: row.price!,
          durationMinutes: row.durationMinutes,
        },
      });
    }

    audit({
      entityId: service.id,
      summary: `${id ? "Updated" : "Created"} service "${service.name}" with ${supplied.length} vehicle-class price${supplied.length === 1 ? "" : "s"}`,
    });

    revalidateServices(service.id);
    return { id: service.id, name: service.name };
  },
});

export const deleteService = defineAction({
  permission: "service:manage",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "DELETE", entity: "Service" },
  handler: async ({ input, audit }) => {
    const service = await db.service.findUnique({
      where: { id: input.id },
      select: { name: true, _count: { select: { bookingServices: true } } },
    });
    if (!service) throw new ActionError("That service no longer exists");

    // Deleting would cascade the join rows and quietly rewrite what customers
    // actually booked, so a used service is deactivated instead.
    if (service._count.bookingServices > 0) {
      throw new ActionError(
        `"${service.name}" appears on ${service._count.bookingServices} booking${
          service._count.bookingServices === 1 ? "" : "s"
        }, so it cannot be deleted. Untick "Active" to hide it from the website instead.`,
      );
    }

    await db.service.delete({ where: { id: input.id } });

    audit({ entityId: input.id, summary: `Deleted service "${service.name}"` });
    revalidateServices();
    return { name: service.name };
  },
});
