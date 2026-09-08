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
        // Services with a per-vehicle price matrix first: they show the pricing
        // model off, and read far better than a lone "from Rs. X".
        orderBy: [
          { isFeatured: "desc" },
          { prices: { _count: "desc" } },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
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
      <section className="relative overflow-hidden border-b border-border bg-surface">
        {/* Decorative layers: a drifting brand glow over a hairline grid. */}
        <div className="pointer-events-none absolute inset-0 grid-texture" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 hero-glow drift"
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="rise-in inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-text">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-primary opacity-75" />
              </span>
              {settings["site.tagline"] || "Vehicle service centre & spare parts"}
            </p>

            <h1 className="rise-in mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Your car,{" "}
              <span className="text-gradient">sorted properly.</span>
            </h1>

            <p className="rise-in-delayed mt-5 max-w-xl text-lg leading-relaxed text-foreground-muted">
              {settings["site.description"] ||
                "Servicing, mechanical repairs, body work and detailing — plus a workshop full of genuine and aftermarket spare parts."}
            </p>

            <div className="rise-in-delayed mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book"
                className="press group inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-card hover:bg-primary-hover"
              >
                <CalendarPlus className="size-4" aria-hidden />
                Book a service
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href="/parts"
                className="press inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised/80 px-7 text-sm font-semibold backdrop-blur hover:border-primary/50 hover:bg-surface-raised"
              >
                <Package className="size-4" aria-hidden />
                Browse {partCount.toLocaleString("en-LK")} parts
              </Link>
            </div>

            <dl className="rise-in-delayed mt-12 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-sm text-foreground-muted">Spare parts listed</dt>
                <dd className="font-display text-3xl font-bold tabular-nums">
                  {partCount.toLocaleString("en-LK")}
                </dd>
              </div>
              <div className="border-l border-border pl-10">
                <dt className="text-sm text-foreground-muted">Services offered</dt>
                <dd className="font-display text-3xl font-bold tabular-nums">
                  {serviceCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="border-b border-border">
        <div className="reveal-stagger mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6">
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
              <span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10">
                <item.icon className="size-5 text-primary-text" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-foreground-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      {featuredServices.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">What we do</h2>
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

          <ul className="reveal-stagger grid gap-4 sm:grid-cols-2">
            {featuredServices.map((service) => (
              <li
                key={service.id}
                className="hover-lift rounded-card border border-border bg-surface-raised p-5"
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
                  className="press mt-4 inline-flex h-10 items-center rounded-lg border border-primary px-4 text-sm font-medium text-primary-text hover:bg-primary/10"
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
            <ul className="reveal-stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/parts?category=${category.slug}`}
                    className="hover-lift flex h-full items-center gap-3 rounded-card border border-border bg-surface-raised p-4 text-sm font-medium hover:border-primary/60"
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
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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

          <ul className="reveal-stagger grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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
        <div className="reveal mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-semibold">Not sure what you need?</h2>
          <p className="mx-auto mt-2 max-w-xl text-foreground-muted">
            Tell us the vehicle and the problem. We will tell you honestly what it
            needs and what it will cost.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {phone && (
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="press inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
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
                className="press inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-surface-raised px-6 text-sm font-semibold hover:border-primary/50"
              >
                <MessageSquare className="size-4" aria-hidden />
                WhatsApp us
              </a>
            )}
            <Link
              href="/contact"
              className="press inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-surface-raised px-6 text-sm font-semibold hover:border-primary/50"
            >
              Send a message
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
