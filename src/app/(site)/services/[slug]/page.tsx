import { ArrowRight, CalendarPlus, Clock, MessageSquare, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ServicePriceTable } from "@/components/site/service-price-table";
import { BreadcrumbJsonLd } from "@/components/site/structured-data";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { toWhatsAppNumber, truncate } from "@/lib/utils";
import { VEHICLE_CLASS_LABELS } from "@/lib/validation/service";

/**
 * A single service.
 *
 * These exist because the migration maps 257 legacy WooCommerce URLs onto
 * `/services/<slug>`. Pointing all of them at the services index would have
 * been a 301 into a page about something else; giving each service its own
 * page keeps those links meaningful and gives the workshop 112 indexable pages
 * describing what it actually does.
 */

async function getService(slug: string) {
  return db.service.findFirst({
    where: { slug, isActive: true },
    include: {
      category: { select: { name: true, slug: true } },
      prices: {
        where: { isActive: true },
        select: { vehicleClass: true, price: true, durationMinutes: true },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) return { title: "Service not found" };

  const description =
    service.seoDescription ||
    service.shortDescription ||
    truncate(
      `${service.name} at Car Dress SL. Priced by vehicle size — book online or call us.`,
      160,
    );

  return {
    title: service.seoTitle || service.name,
    description,
    openGraph: { title: service.seoTitle || service.name, description },
  };
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;

  const service = await getService(slug);
  if (!service) notFound();

  const [settings, related] = await Promise.all([
    getSettings(),
    service.categoryId
      ? db.service.findMany({
          where: {
            isActive: true,
            categoryId: service.categoryId,
            id: { not: service.id },
          },
          orderBy: [{ prices: { _count: "desc" } }, { name: "asc" }],
          take: 6,
          select: { name: true, slug: true },
        })
      : Promise.resolve([]),
  ]);

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const phone = settings["contact.phone"];
  const whatsapp = settings["contact.whatsapp"];

  const enquiryText = `Hi, I'd like to ask about ${service.name}.`;

  const crumbs = [
    { name: "Services", path: "/services" },
    ...(service.category
      ? [{ name: service.category.name, path: `/services#${service.category.slug}` }]
      : []),
    { name: service.name, path: `/services/${service.slug}` },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd trail={crumbs} baseUrl={baseUrl} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-foreground-muted">
          <li>
            <Link href="/services" className="hover:text-foreground">
              Services
            </Link>
          </li>
          {service.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/services#${service.category.slug}`}
                  className="hover:text-foreground"
                >
                  {service.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <header>
        {service.category && (
          <Badge tone="brand">{service.category.name}</Badge>
        )}
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{service.name}</h1>
        {service.shortDescription && (
          <p className="mt-3 text-lg text-foreground-muted">
            {service.shortDescription}
          </p>
        )}
      </header>

      <section className="mt-8 rounded-card border border-border bg-surface-raised p-5">
        <h2 className="text-base font-semibold">What it costs</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          {service.prices.length > 0
            ? "Priced by vehicle size. Larger vehicles take longer and use more material."
            : "Final price confirmed before any work starts."}
        </p>

        <ServicePriceTable
          prices={service.prices}
          basePrice={service.basePrice}
          priceFrom={service.priceFrom}
          durationMinutes={service.durationMinutes}
          className="mt-4"
        />

        {service.durationMinutes && service.prices.length === 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-foreground-muted">
            <Clock className="size-4" aria-hidden />
            Usually about{" "}
            {service.durationMinutes >= 60
              ? `${Math.round(service.durationMinutes / 60)} hour(s)`
              : `${service.durationMinutes} minutes`}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/book?service=${service.slug}`}
            className="press inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Book this service
          </Link>
          {whatsapp && (
            <a
              href={`https://wa.me/${toWhatsAppNumber(whatsapp)}?text=${encodeURIComponent(enquiryText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold hover:border-primary/50"
            >
              <MessageSquare className="size-4" aria-hidden />
              Ask a question
            </a>
          )}
          {!whatsapp && phone && (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="press inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold hover:border-primary/50"
            >
              <Phone className="size-4" aria-hidden />
              Call us
            </a>
          )}
        </div>
      </section>

      {service.description && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">About this service</h2>
          <div className="mt-2 whitespace-pre-wrap text-foreground-muted">
            {service.description}
          </div>
        </section>
      )}

      {service.prices.length > 1 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Which size is my vehicle?</h2>
          <ul className="mt-3 grid gap-2 text-sm text-foreground-muted sm:grid-cols-2">
            {service.prices.map((price) => (
              <li
                key={price.vehicleClass}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              >
                <strong className="text-foreground">
                  {VEHICLE_CLASS_LABELS[
                    price.vehicleClass as keyof typeof VEHICLE_CLASS_LABELS
                  ] ?? price.vehicleClass}
                </strong>{" "}
                — not sure? Send us your registration number and we will tell you.
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">
            Other {service.category?.name.toLowerCase() ?? "services"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {related.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/services/${item.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-border px-3 py-1.5 text-sm text-foreground-muted hover:border-primary/50 hover:text-foreground"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8">
        <Link
          href="/services"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline"
        >
          All services
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
