import { CalendarPlus, Car, Package, ShieldCheck, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "About us",
  description:
    "A vehicle service centre, mechanical workshop and spare parts supplier under one roof.",
};

export default async function AboutPage() {
  const [settings, page, counts] = await Promise.all([
    getSettings(),
    // Editable from the admin once the CMS lands; falls back to the copy below.
    db.page.findFirst({ where: { slug: "about", isPublished: true } }),
    Promise.all([
      db.product.count({ where: { isActive: true, price: { gt: 0 } } }),
      db.service.count({ where: { isActive: true } }),
      db.category.count({ where: { isActive: true, parentId: null } }),
    ]),
  ]);

  const [partCount, serviceCount, categoryCount] = counts;
  const name = settings["site.name"] || "Car Dress SL";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{page?.title ?? `About ${name}`}</h1>
        {settings["site.tagline"] && (
          <p className="mt-2 text-lg text-foreground-muted">
            {settings["site.tagline"]}
          </p>
        )}
      </header>

      {page?.content ? (
        <div className="whitespace-pre-wrap text-foreground-muted">{page.content}</div>
      ) : (
        <div className="space-y-4 text-foreground-muted">
          <p>
            {name} is a vehicle service centre, mechanical workshop and spare
            parts supplier under one roof. That combination is the point: the
            people diagnosing your car are the same people who can source the
            part and fit it, so nothing gets lost between a garage and a parts
            shop.
          </p>
          <p>
            We handle routine servicing, mechanical repairs, body and paint work,
            detailing and wheel alignment — and we keep{" "}
            {partCount.toLocaleString("en-LK")} spare parts listed across{" "}
            {categoryCount} categories, from brake pads and suspension components
            to filters, oils and body panels.
          </p>
          <p>
            Our service prices are set per vehicle size rather than quoted on the
            spot, so you know what a job costs for a car, a van or an SUV before
            you commit. If a part needs ordering, we tell you what it costs and
            how long it takes.
          </p>
        </div>
      )}

      <dl className="mt-10 grid grid-cols-3 gap-4 border-y border-border py-6 text-center">
        <div>
          <dt className="text-sm text-foreground-muted">Parts listed</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {partCount.toLocaleString("en-LK")}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-foreground-muted">Services</dt>
          <dd className="text-2xl font-semibold tabular-nums">{serviceCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-foreground-muted">Categories</dt>
          <dd className="text-2xl font-semibold tabular-nums">{categoryCount}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">What we do</h2>
        <ul className="mt-4 space-y-4">
          {[
            {
              icon: Wrench,
              title: "Servicing and mechanical repair",
              body: "Routine servicing, diagnostics, engine and gearbox work, suspension, brakes and electrical faults.",
            },
            {
              icon: Car,
              title: "Body, paint and detailing",
              body: "Panel repair, repainting, cut and polish, waxing, interior detailing and under-coating.",
            },
            {
              icon: Package,
              title: "Spare parts",
              body: "Genuine, OEM, aftermarket and reconditioned parts. If it is not listed, ask — we can usually source it.",
            },
            {
              icon: ShieldCheck,
              title: "Fitting what we sell",
              body: "Buy the part and have it fitted in the same visit, by the people who recommended it.",
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-3">
              <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="font-medium text-foreground">{item.title}</h3>
                <p className="text-sm text-foreground-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-col gap-3 rounded-card border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">Ready to book your vehicle in?</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/book"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Book a service
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center rounded-lg border border-border bg-surface-raised px-4 text-sm font-semibold hover:bg-background"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
