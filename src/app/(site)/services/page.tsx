import { CalendarPlus, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ServicePriceTable } from "@/components/site/service-price-table";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Servicing, mechanical repairs, body work, detailing and wheel alignment. Prices by vehicle size.",
};

export default async function ServicesPage() {
  const [categories, uncategorised, settings] = await Promise.all([
    db.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        services: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            basePrice: true,
            priceFrom: true,
            durationMinutes: true,
            prices: {
              where: { isActive: true },
              select: { vehicleClass: true, price: true, durationMinutes: true },
            },
          },
        },
      },
    }),
    db.service.findMany({
      where: { isActive: true, categoryId: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        basePrice: true,
        priceFrom: true,
        durationMinutes: true,
        prices: {
          where: { isActive: true },
          select: { vehicleClass: true, price: true, durationMinutes: true },
        },
      },
    }),
    getSettings(),
  ]);

  const groups = [
    ...categories.filter((c) => c.services.length > 0),
    ...(uncategorised.length
      ? [{ id: "other", name: "Other work", slug: "other", services: uncategorised }]
      : []),
  ];

  const totalServices = groups.reduce((sum, g) => sum + g.services.length, 0);
  const phone = settings["contact.phone"];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">What we do</h1>
        <p className="mt-2 max-w-2xl text-foreground-muted">
          {totalServices} services across servicing, mechanical repair, body work
          and detailing. Prices vary by vehicle size — the tables below show what
          each job costs for your class of vehicle.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/book"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Book a service
          </Link>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-5 text-sm font-semibold hover:bg-surface"
            >
              <Phone className="size-4" aria-hidden />
              Talk to us
            </a>
          )}
        </div>
      </header>

      {/* Jump links, so a long page stays navigable on a phone. */}
      {groups.length > 1 && (
        <nav aria-label="Service categories" className="mb-8">
          <ul className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <li key={group.slug}>
                <a
                  href={`#${group.slug}`}
                  className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-3 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                >
                  {group.name}
                  <span className="ml-1.5 text-xs opacity-70">
                    {group.services.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="space-y-12">
        {groups.map((group) => (
          <section key={group.id} id={group.slug} className="scroll-mt-20">
            <h2 className="text-xl font-semibold">{group.name}</h2>

            <ul className="mt-4 space-y-4">
              {group.services.map((service) => (
                <li
                  key={service.id}
                  className="hover-lift rounded-card border border-border bg-surface-raised p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium">
                        <Link
                          href={`/services/${service.slug}`}
                          className="hover:text-primary-text hover:underline"
                        >
                          {service.name}
                        </Link>
                      </h3>
                      {service.shortDescription && (
                        <p className="mt-1 text-sm text-foreground-muted">
                          {service.shortDescription}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/book?service=${service.slug}`}
                      className="inline-flex h-10 shrink-0 items-center rounded-lg border border-primary px-4 text-sm font-medium text-primary-text hover:bg-primary/10"
                    >
                      Book this
                    </Link>
                  </div>

                  <ServicePriceTable
                    prices={service.prices}
                    basePrice={service.basePrice}
                    priceFrom={service.priceFrom}
                    durationMinutes={service.durationMinutes}
                    className="mt-3"
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-12 text-center text-foreground-muted">
          Our service list is being updated. Please call us and we will talk you
          through what we can do.
        </p>
      )}
    </div>
  );
}
