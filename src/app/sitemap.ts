import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * The sitemap, generated from what is actually published.
 *
 * Only sellable products appear — the same `isActive && price > 0` rule the
 * catalogue uses. Submitting the 261 unpriced or invoice-line rows would ask
 * Google to index pages that 404, which is a slow way to lose trust in the
 * whole sitemap.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  const [products, services, categories, brands] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, price: { gt: 0 } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.service.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({
      where: { isActive: true, products: { some: { isActive: true, price: { gt: 0 } } } },
      select: { slug: true, updatedAt: true },
    }),
    db.brand.findMany({
      where: { isActive: true, products: { some: { isActive: true, price: { gt: 0 } } } },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/services`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/parts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  /*
   * Filtered catalogue views are given a low priority rather than omitted.
   * They are genuinely useful landing pages — "brake pads" is a real search —
   * but they must not outrank the product pages themselves.
   */
  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${base}/parts?category=${encodeURIComponent(c.slug)}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const brandPages: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${base}/parts?brand=${encodeURIComponent(b.slug)}`,
    lastModified: b.updatedAt,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/parts/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Services are a single page with anchors, so they share the /services URL —
  // listing each slug separately would submit URLs that do not exist yet.
  void services;

  return [...staticPages, ...categoryPages, ...brandPages, ...productPages];
}
