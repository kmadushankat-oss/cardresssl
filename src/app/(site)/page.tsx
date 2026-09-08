import {
  ArrowRight,
  CalendarPlus,
  Car,
  ImageOff,
  MessageSquare,
  Package,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AnimatedHeadline, FadeUp } from "@/components/site/animated-headline";
import { CountUp } from "@/components/site/count-up";
import { ProductCard } from "@/components/site/product-card";
import { Reveal, RevealGroup } from "@/components/site/reveal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { toWhatsAppNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Vehicle service, mechanical repairs & spare parts",
};

const WHY_US = [
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
];

export default async function HomePage() {
  const [settings, featuredServices, featuredParts, categories, counts] =
    await Promise.all([
      getSettings(),
      db.service.findMany({
        where: { isActive: true },
        // Services with a per-vehicle price matrix first: they demonstrate the
        // pricing model, which is the thing worth clicking through for.
        orderBy: [
          { isFeatured: "desc" },
          { prices: { _count: "desc" } },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
        take: 6,
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          category: { select: { name: true } },
          _count: { select: { prices: true } },
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
        select: { name: true, slug: true, imageUrl: true },
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
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="pointer-events-none absolute inset-0 grid-texture" aria-hidden />
        <div className="pointer-events-none absolute inset-0 hero-glow drift" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <FadeUp>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-text">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                {settings["site.tagline"] || "Vehicle service centre & spare parts"}
              </p>
            </FadeUp>

            <AnimatedHeadline
              text="Your car, sorted properly."
              // "sorted properly." takes the brand gradient.
              highlightFrom={2}
              stagger={0.09}
              delay={0.15}
              className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
            />

            <FadeUp delay={0.5}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-foreground-muted">
                {settings["site.description"] ||
                  "Servicing, mechanical repairs, body work and detailing — plus a workshop full of genuine and aftermarket spare parts."}
              </p>
            </FadeUp>

            <FadeUp delay={0.62}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
            </FadeUp>

            <FadeUp delay={0.74}>
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <dt className="text-sm text-foreground-muted">Spare parts listed</dt>
                  <dd className="font-display text-3xl font-bold tabular-nums">
                    <CountUp value={partCount} />
                  </dd>
                </div>
                <div className="border-l border-border pl-10">
                  <dt className="text-sm text-foreground-muted">Services offered</dt>
                  <dd className="font-display text-3xl font-bold tabular-nums">
                    <CountUp value={serviceCount} duration={1100} />
                  </dd>
                </div>
              </dl>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ---------------- Why us ---------------- */}
      <section className="border-b border-border">
        <RevealGroup className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {WHY_US.map((item) => (
            <div key={item.title}>
              <span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10">
                <item.icon className="size-5 text-primary-text" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-foreground-muted">{item.body}</p>
            </div>
          ))}
        </RevealGroup>
      </section>

      {/* ---------------- What we do ---------------- */}
      {featuredServices.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">What we do</h2>
              <p className="mt-1 text-foreground-muted">
                Tap any job to see what it costs for your size of vehicle.
              </p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline"
            >
              All {serviceCount} services
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Reveal>

          {/*
            Titles only — no prices here.
            A price is meaningless without the vehicle it applies to, and
            printing "from Rs. 600" beside a job that costs Rs. 14,500 for an
            SUV sets exactly the wrong expectation. The detail page carries the
            full matrix, so the click is where the number belongs.
          */}
          <RevealGroup
            as="ul"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            stagger={0.06}
          >
            {featuredServices.map((service) => (
              <li key={service.id}>
                <Link
                  href={`/services/${service.slug}`}
                  className="hover-lift group flex h-full flex-col rounded-card border border-border bg-surface-raised p-5 hover:border-primary/60"
                >
                  {service.category && (
                    <span className="text-xs font-medium uppercase tracking-wide text-primary-text">
                      {service.category.name}
                    </span>
                  )}
                  <h3 className="mt-1 font-display text-lg font-semibold">
                    {service.name}
                  </h3>
                  {service.shortDescription && (
                    <p className="mt-1 line-clamp-2 text-sm text-foreground-muted">
                      {service.shortDescription}
                    </p>
                  )}

                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text">
                    {service._count.prices > 1 ? "See prices & book" : "See details & book"}
                    <ArrowRight
                      className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ---------------- Shop by category ---------------- */}
      {categories.length > 0 && (
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="text-2xl font-semibold">Shop parts by category</h2>
              <p className="mt-1 text-foreground-muted">
                Everything from brake pads to engine oil.
              </p>
            </Reveal>

            <RevealGroup
              as="ul"
              className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              stagger={0.05}
            >
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/parts?category=${category.slug}`}
                    className="hover-lift group block overflow-hidden rounded-card border border-border bg-surface-raised hover:border-primary/60"
                  >
                    {/*
                      Room for one photo per category. Until the client uploads
                      one this is a branded placeholder rather than a broken
                      image or a collapsed card — the layout must not depend on
                      artwork that does not exist yet.
                    */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div
                          className="grid h-full place-items-center grid-texture"
                          aria-hidden
                        >
                          <ImageOff className="size-7 text-foreground-subtle" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 p-3">
                      <span className="truncate text-sm font-medium">{category.name}</span>
                      <ArrowRight
                        className="size-4 shrink-0 text-foreground-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary-text"
                        aria-hidden
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* ---------------- Featured parts ---------------- */}
      {featuredParts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">In the shop</h2>
            <Link
              href="/parts"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline"
            >
              All parts
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Reveal>

          <RevealGroup
            as="ul"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
            stagger={0.05}
          >
            {featuredParts.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* ---------------- Closing CTA ---------------- */}
      <section className="border-t border-border bg-surface">
        <Reveal className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
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
        </Reveal>
      </section>
    </>
  );
}
