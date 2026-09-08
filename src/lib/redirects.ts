import { db } from "@/lib/db";

/**
 * Serve a legacy WooCommerce URL.
 *
 * Deliberately *not* implemented as middleware. Middleware runs on every
 * request and cannot reach Prisma without the experimental Node runtime flag,
 * so instead the legacy paths get real route handlers — `/product/[slug]` and
 * `/product-category/[slug]`. Those are Node by default, Prisma works
 * natively, and a visitor to any other page never touches this code.
 *
 * The old site has ~1,400 indexed URLs. Losing them at cutover would cost the
 * client the search rankings they already have, which is why every mapped path
 * gets a redirect rather than a 404.
 */

export type ResolvedRedirect = {
  toPath: string;
  statusCode: number;
  /** True when the mapped target was unpublished and we substituted a fallback. */
  degraded: boolean;
};

/**
 * Is the mapped target actually a live page?
 *
 * The importer records where each old URL *should* go, but it cannot know
 * whether that item will be published — 351 products arrived with no price and
 * 33 service rows are internal labour lines, all of them deliberately hidden.
 * Sending a crawler to a 404 is worse than not redirecting at all, so the
 * decision is made here, at request time, against the current data.
 */
async function findLiveFallback(toPath: string): Promise<string | null> {
  const partMatch = toPath.match(/^\/parts\/([^/?#]+)$/);
  if (partMatch) {
    const product = await db.product.findUnique({
      where: { slug: decodeURIComponent(partMatch[1]) },
      select: {
        isActive: true,
        price: true,
        category: {
          select: { slug: true, isActive: true, parent: { select: { slug: true } } },
        },
      },
    });

    // Published and sellable: the mapped path is correct as-is.
    if (product && product.isActive && Number(product.price) > 0) return null;

    /*
     * Not sellable, but we know what kind of part it was — so send the visitor
     * to that category rather than the whole catalogue. Someone looking for a
     * brake hose lands among brake parts, which is a far better answer than a
     * dead end or 440 unrelated items.
     */
    const categorySlug =
      product?.category?.parent?.slug ??
      (product?.category?.isActive ? product.category.slug : undefined);

    return categorySlug ? `/parts?category=${categorySlug}` : "/parts";
  }

  const serviceMatch = toPath.match(/^\/services\/([^/?#]+)$/);
  if (serviceMatch) {
    const service = await db.service.findUnique({
      where: { slug: decodeURIComponent(serviceMatch[1]) },
      select: { isActive: true, category: { select: { slug: true } } },
    });

    if (service?.isActive) return null;

    // An unpublished service still tells us the department it belonged to.
    return service?.category?.slug
      ? `/services#${service.category.slug}`
      : "/services";
  }

  // Anything else (a category path, or a hand-edited target) is taken as given.
  return null;
}

export async function resolveLegacyPath(
  fromPath: string,
): Promise<ResolvedRedirect | null> {
  const redirect = await db.redirect.findFirst({
    where: { fromPath, isActive: true },
    select: { id: true, toPath: true, statusCode: true },
  });

  if (!redirect) return null;

  const fallback = await findLiveFallback(redirect.toPath);

  /*
   * Record the hit, but never make the visitor wait for it and never let a
   * failed counter turn a working redirect into an error — the whole point is
   * that the old link keeps working.
   */
  void db.redirect
    .update({
      where: { id: redirect.id },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch((error) => {
      console.error("[redirects] could not record a hit", error);
    });

  if (fallback) {
    /*
     * A substituted destination is a 302, not a 301. The item may well be
     * published later — once the client sets a price — and a cached permanent
     * redirect to the category page would then be wrong and very hard to undo
     * in crawlers and browsers.
     */
    return { toPath: fallback, statusCode: 302, degraded: true };
  }

  return {
    toPath: redirect.toPath,
    statusCode: redirect.statusCode,
    degraded: false,
  };
}

/**
 * Where to send a legacy URL that has no mapping at all.
 *
 * A 404 is the honest answer for a product that genuinely never existed, but
 * for a *category* path the parts catalogue is a much better destination than a
 * dead end — the visitor was shopping, so put them in the shop.
 */
export const LEGACY_FALLBACKS = {
  product: null,
  productCategory: "/parts",
} as const;
