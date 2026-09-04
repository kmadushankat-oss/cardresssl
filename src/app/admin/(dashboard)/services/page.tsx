import { Plus, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { VEHICLE_CLASS_LABELS, VEHICLE_CLASSES } from "@/lib/validation/service";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const user = await requirePermission("service:view");
  const canManage = can(user.role, "service:manage");

  const categories = await db.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      services: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          isActive: true,
          basePrice: true,
          priceFrom: true,
          prices: { select: { vehicleClass: true, price: true } },
        },
      },
    },
  });

  const uncategorised = await db.service.findMany({
    where: { categoryId: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      basePrice: true,
      priceFrom: true,
      prices: { select: { vehicleClass: true, price: true } },
    },
  });

  const groups = [
    ...categories.filter((c) => c.services.length > 0),
    ...(uncategorised.length
      ? [{ id: "none", name: "Uncategorised", services: uncategorised }]
      : []),
  ];

  const total = groups.reduce((sum, g) => sum + g.services.length, 0);

  /** Only show columns for classes anyone is actually priced for. */
  const usedClasses = VEHICLE_CLASSES.filter((vc) =>
    groups.some((g) => g.services.some((s) => s.prices.some((p) => p.vehicleClass === vc))),
  );

  return (
    <div>
      <PageHeader
        title="Services"
        description={`${total} service${total === 1 ? "" : "s"}. Prices can vary by vehicle size.`}
        actions={
          canManage && (
            <Link
              href="/admin/services/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Plus className="size-4" aria-hidden />
              New service
            </Link>
          )
        }
      />

      {total === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface">
            <Wrench className="size-5 text-foreground-muted" aria-hidden />
          </div>
          <h2 className="font-display font-semibold">No services yet</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Add the jobs the workshop offers, with a price for each vehicle size.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.id}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                {group.name}
              </h2>

              <div className="rounded-card border border-border bg-surface-raised">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-surface text-left">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Service
                        </th>
                        {usedClasses.map((vc) => (
                          <th
                            key={vc}
                            scope="col"
                            className="px-3 py-3 text-right font-medium whitespace-nowrap"
                          >
                            {VEHICLE_CLASS_LABELS[vc]}
                          </th>
                        ))}
                        <th scope="col" className="px-4 py-3 font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.services.map((service) => {
                        const byClass = new Map(
                          service.prices.map((p) => [p.vehicleClass, p.price]),
                        );
                        return (
                          <tr
                            key={service.id}
                            className="border-b border-border-subtle last:border-0 hover:bg-surface"
                          >
                            <td className="px-4 py-3">
                              {canManage ? (
                                <Link
                                  href={`/admin/services/${service.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {service.name}
                                </Link>
                              ) : (
                                <span className="font-medium">{service.name}</span>
                              )}
                              {service.prices.length === 0 && service.basePrice && (
                                <span className="ml-2 text-xs text-foreground-subtle">
                                  {service.priceFrom ? "from " : ""}
                                  {formatPrice(service.basePrice)}
                                </span>
                              )}
                            </td>
                            {usedClasses.map((vc) => {
                              const price = byClass.get(vc);
                              return (
                                <td
                                  key={vc}
                                  className="px-3 py-3 text-right tabular-nums whitespace-nowrap"
                                >
                                  {price ? (
                                    formatPrice(price)
                                  ) : (
                                    <span className="text-foreground-subtle">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3">
                              <Badge tone={service.isActive ? "success" : "neutral"}>
                                {service.isActive ? "Active" : "Hidden"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
