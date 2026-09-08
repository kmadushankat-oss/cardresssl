import {
  ArrowRight,
  CalendarPlus,
  Car,
  MessageSquare,
  Package,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/site/product-card";
import { ServicePriceTable } from "@/components/site/service-price-table";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { toWhatsAppNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Vehicle service, mechanical repairs & spare parts",
};

export default async function HomePage() {
  const [settings, featuredServices, featuredParts, categories, counts] =
    await Promise.all([
      getSettings(),
      db.service.findMany({
        where: { isActive: true },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        take: 4,
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
      db.product.findMany({
        where: { isActive: true, price: { gt: 0 } },
        orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }, { updatedAt: "desc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          discountedPrice: true,
          condition: true,
          brand: { select: { name: true } },
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: { url: true, alt: true },
          },
        },
      }),
      db.category.findMany({
        where: {
          isActive: true,
          parentId: null,
          OR: [
            { products: { some: { isActive: true, price: { gt: 0 } } } },
            {
              children: {
                some: { products: { some: { isActive: true, price: { gt: 0 } } } },
              },
            },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 8,
        select: { name: true, slug: true, iconName: true },
      }),
      Promise.all([
        db.product.count({ where: { isActive: true, price: { gt: 0 } } }),
        db.service.count({ where: { isActive: true } }),
      ]),
    ]);

  const [partCount, serviceCount] = counts;
  const phone = settings["contact.phone"];
  const whatsapp = settings["contact.whatsapp"];

  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-primary-text">
              {settings["site.tagline"] || "Vehicle service centre & spare parts"}
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              Your car, sorted properly.
            </h1>
            <p className="mt-4 text-lg text-foreground-muted">
              {settings["site.description"] ||
                "Servicing, mechanical repairs, body work and detailing — plus a workshop full of genuine and aftermarket spare parts."}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                <CalendarPlus className="size-4" aria-hidden />
                Book a service
              </Link>
              <Link
                href="/parts"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-6 text-sm font-semibold hover:bg-background"
              >
                <Package className="size-4" aria-hidden />
                Browse {partCount.toLocaleString("en-LK")} parts
              </Link>
            </div>

            <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-foreground-muted">Spare parts listed</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {partCount.toLocaleString("en-LK")}
                </dd>
              </div>
              <div>
                <dt className="text-foreground-muted">Services offered</dt>
                <dd className="text-2xl font-semibold tabular-nums">{serviceCount}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            {
              icon: Wrench,
              title: "One place for everything",
              body: "Servicing, mechanical work, body repairs and detailing — and the parts to go with them.",
            },
            {
              icon: ShieldCheck,
              title: "The right part, confirmed",
              body: "Tell us your make, model and year and we check the fit before you pay for anything.",
            },
            {
              icon: Car,
              title: "Priced by your vehicle",
              body: "Car, van or SUV — our service prices are set per vehicle size, with no surprises.",
            },
          ].map((item) => (
            <div key={item.title}>
              <item.icon className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-foreground-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      {featuredServices.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Popular services</h2>
              <p className="mt-1 text-foreground-muted">
                Prices shown per vehicle size.
              </p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline"
            >
              All {serviceCount} services
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {featuredServices.map((service) => (
              <li
                key={service.id}
                className="rounded-card border border-border bg-surface-raised p-5"
              >
                <h3 className="font-medium">{service.name}</h3>
                {service.shortDescription && (
                  <p className="mt-1 text-sm text-foreground-muted">
                    {service.shortDescription}
                  </p>
                )}
                <ServicePriceTable
                  prices={service.prices}
                  basePrice={service.basePrice}
                  priceFrom={service.priceFrom}
                  durationMinutes={service.durationMinutes}
                  className="mt-3"
                />
                <Link
                  href={`/book?service=${service.slug}`}
                  className="mt-4 inline-flex h-10 items-center rounded-lg border border-primary px-4 text-sm font-medium text-primary-text hover:bg-primary/10"
                >
                  Book this
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Shop by category */}
      {categories.length > 0 && (
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-2xl font-semibold">Shop parts by category</h2>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/parts?category=${category.slug}`}
                    className="flex h-full items-center gap-2 rounded-card border border-border bg-surface-raised p-4 text-sm font-medium hover:border-primary"
                  >
                    <Package className="size-4 shrink-0 text-primary" aria-hidden />
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Featured parts */}
      {featuredParts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">In the shop</h2>
            <Link
              href="/parts"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline"
            >
              All parts
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {featuredParts.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Closing CTA */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
          <h2 className="text-2xl font-semibold">Not sure what you need?</h2>
          <p className="mx-auto mt-2 max-w-xl text-foreground-muted">
            Tell us the vehicle and the problem. We will tell you honestly what it
            needs and what it will cost.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {phone && (
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                <Phone className="size-4" aria-hidden />
                Call {phone}
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${toWhatsAppNumber(whatsapp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-surface-raised px-6 text-sm font-semibold hover:bg-background"
              >
                <MessageSquare className="size-4" aria-hidden />
                WhatsApp us
              </a>
            )}
            <Link
              href="/contact"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-surface-raised px-6 text-sm font-semibold hover:bg-background"
            >
              Send a message
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
