import { resolveLegacyPath } from "@/lib/redirects";

/**
 * Legacy WooCommerce product URL: `/product/<slug>`.
 *
 * Every one of the old site's indexed product pages lived here, so this handler
 * is what stops the switchover throwing away the client's search rankings and
 * every link anyone has ever shared.
 *
 * The status code comes from the database row rather than from
 * `permanentRedirect()`, which emits 308. Google treats 301 and 308 alike, but
 * 301 is what every SEO tool, log analyser and older crawler expects from a
 * moved page — and the `Redirect.statusCode` column exists precisely so the
 * client can choose per row.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const match = await resolveLegacyPath(`/product/${slug}`);

  if (!match) {
    // No mapping: the product genuinely no longer exists. A 404 is the honest
    // signal to a crawler, rather than a soft redirect to something unrelated.
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, {
    status: match.statusCode,
    headers: {
      Location: new URL(match.toPath, request.url).toString(),
      // A permanent redirect is safe to cache; a temporary one is not.
      "Cache-Control":
        match.statusCode === 301
          ? "public, max-age=3600, s-maxage=86400"
          : "no-store",
    },
  });
}
