import { LEGACY_FALLBACKS, resolveLegacyPath } from "@/lib/redirects";

/**
 * Legacy WooCommerce category URL: `/product-category/<slug>`.
 *
 * Unlike a dead product, an unmapped category should not 404. The old
 * categories were Car / Van / SUV / Service / Indoor Plants and those concepts
 * no longer exist in the new part-type tree — but somebody landing on one was
 * shopping for parts, so the catalogue is a far better answer than a dead end.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const match = await resolveLegacyPath(`/product-category/${slug}`);
  const target = match?.toPath ?? LEGACY_FALLBACKS.productCategory;
  const status = match?.statusCode ?? 301;

  return new Response(null, {
    status,
    headers: {
      Location: new URL(target, request.url).toString(),
      "Cache-Control":
        status === 301 ? "public, max-age=3600, s-maxage=86400" : "no-store",
    },
  });
}
