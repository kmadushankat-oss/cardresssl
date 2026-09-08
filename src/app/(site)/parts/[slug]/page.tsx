import { Check, ImageOff, MessageSquare, Phone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/site/product-card";
import { Badge } from "@/components/ui/badge";
import {
  BreadcrumbJsonLd,
  ProductJsonLd,
} from "@/components/site/structured-data";
import { env } from "@/lib/env";
import { discountPercent, effectivePrice, formatPrice } from "@/lib/money";
import { getPublicProduct, relatedProducts } from "@/lib/queries/catalogue";
import { getSettings } from "@/lib/settings";
import { toWhatsAppNumber, truncate } from "@/lib/utils";

const CONDITION_LABELS: Record<string, string> = {
  NEW: "New",
  USED: "Used",
  REFURBISHED: "Reconditioned",
  OEM: "Genuine / OEM",
  AFTERMARKET: "Aftermarket",
};

export async function generateMetadata({
  params,
}: PageProps<"/parts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) return { title: "Part not found" };

  const description =
    product.seoDescription ||
    product.shortDescription ||
    truncate(
      `${product.name}${product.brand ? ` by ${product.brand.name}` : ""} — available at Car Dress SL.`,
      160,
    );

  return {
    title: product.seoTitle || product.name,
    description,
    openGraph: {
      title: product.seoTitle || product.name,
      description,
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function PartPage({ params }: PageProps<"/parts/[slug]">) {
  const { slug } = await params;

  const product = await getPublicProduct(slug);
  if (!product) notFound();

  const [related, settings] = await Promise.all([
    relatedProducts(product.id, product.categoryId),
    getSettings(),
  ]);

  const price = effectivePrice(product);
  const saving = discountPercent(product);
  const phone = settings["contact.phone"];
  const whatsapp = settings["contact.whatsapp"];

  const enquiryText = `Hi, I'd like to ask about ${product.name} (${product.sku}).`;

  const specs = [
    product.sku && { label: "Our code", value: product.sku, mono: true },
    product.partNumber && { label: "Part number", value: product.partNumber, mono: true },
    product.brand?.name && { label: "Brand", value: product.brand.name },
    { label: "Condition", value: CONDITION_LABELS[product.condition] ?? product.condition },
    product.warrantyMonths && {
      label: "Warranty",
      value: `${product.warrantyMonths} months`,
    },
    product.weightGrams && { label: "Weight", value: `${product.weightGrams} g` },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  /* The trail shown to a person and the one given to search engines are the
     same list, so they cannot drift apart. */
  const crumbs = [
    { name: "Spare parts", path: "/parts" },
    ...(product.category?.parent
      ? [
          {
            name: product.category.parent.name,
            path: `/parts?category=${product.category.parent.slug}`,
          },
        ]
      : []),
    ...(product.category
      ? [
          {
            name: product.category.name,
            path: `/parts?category=${product.category.slug}`,
          },
        ]
      : []),
    { name: product.name, path: `/parts/${product.slug}` },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <ProductJsonLd
        product={product}
        baseUrl={baseUrl}
        currency={settings["commerce.currency"] || "LKR"}
      />
      <BreadcrumbJsonLd trail={crumbs} baseUrl={baseUrl} />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-foreground-muted">
          <li>
            <Link href="/parts" className="hover:text-foreground">
              Spare parts
            </Link>
          </li>
          {product.category?.parent && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/parts?category=${product.category.parent.slug}`}
                  className="hover:text-foreground"
                >
                  {product.category.parent.name}
                </Link>
              </li>
            </>
          )}
          {product.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/parts?category=${product.category.slug}`}
                  className="hover:text-foreground"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-surface">
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].alt ?? product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <ImageOff className="mx-auto size-10 text-foreground-subtle" aria-hidden />
                  <p className="mt-2 text-sm text-foreground-subtle">
                    Photo coming soon
                  </p>
                </div>
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {product.images.slice(0, 5).map((image) => (
                <li key={image.id}>
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface">
                    <Image
                      src={image.url}
                      alt={image.alt ?? ""}
                      fill
                      sizes="20vw"
                      className="object-cover"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.brand?.name && (
              <Link
                href={`/parts?brand=${product.brand.slug}`}
                className="text-sm text-foreground-muted hover:text-foreground"
              >
                {product.brand.name}
              </Link>
            )}
            {saving > 0 && <Badge tone="danger">−{saving}%</Badge>}
            <Badge tone="info">
              {CONDITION_LABELS[product.condition] ?? product.condition}
            </Badge>
          </div>

          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{product.name}</h1>

          <p className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {formatPrice(price)}
            </span>
            {saving > 0 && (
              <s className="text-lg text-foreground-subtle tabular-nums">
                {formatPrice(product.price)}
              </s>
            )}
            {Number(product.taxRate) > 0 && (
              <span className="text-sm text-foreground-subtle">
                {product.taxInclusive ? "incl." : "excl."} tax
              </span>
            )}
          </p>

          {product.shortDescription && (
            <p className="mt-3 text-foreground-muted">{product.shortDescription}</p>
          )}

          {/* Enquiry CTAs — there is no online payment, so the goal is contact. */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {whatsapp && (
              <a
                href={`https://wa.me/${toWhatsAppNumber(whatsapp)}?text=${encodeURIComponent(enquiryText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                <MessageSquare className="size-4" aria-hidden />
                Ask about this part
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-5 text-sm font-semibold hover:bg-surface"
              >
                <Phone className="size-4" aria-hidden />
                Call to order
              </a>
            )}
          </div>

          <p className="mt-3 flex items-start gap-2 text-sm text-foreground-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            Tell us your vehicle and we will confirm this is the right part before
            you buy.
          </p>

          {/* Specifications */}
          <dl className="mt-6 divide-y divide-border-subtle border-y border-border-subtle text-sm">
            {specs.map((spec) => (
              <div key={spec.label} className="flex gap-4 py-2.5">
                <dt className="w-32 shrink-0 text-foreground-muted">{spec.label}</dt>
                <dd className={spec.mono ? "font-mono text-xs" : undefined}>
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Fitment table — what this part fits. */}
          {product.fitments.length > 0 && (
            <section className="mt-6">
              <h2 className="text-base font-semibold">Fits these vehicles</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {product.fitments.map((fit) => (
                  <li key={fit.id} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>
                      {[fit.make, fit.model].filter(Boolean).join(" ")}
                      {(fit.yearFrom || fit.yearTo) && (
                        <span className="text-foreground-muted">
                          {" "}
                          {fit.yearFrom ?? ""}
                          {fit.yearFrom || fit.yearTo ? "–" : ""}
                          {fit.yearTo ?? "present"}
                        </span>
                      )}
                      {fit.engine && (
                        <span className="text-foreground-muted"> · {fit.engine}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {product.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-semibold">Description</h2>
          <div className="mt-2 whitespace-pre-wrap text-foreground-muted">
            {product.description}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">
            Others in {product.category?.name ?? "this category"}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {related.map((item) => (
              <li key={item.slug}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
