import type { MetadataRoute } from "next";

import { env, isProduction } from "@/lib/env";

/**
 * robots.txt.
 *
 * Everything is disallowed outside production, so a Vercel preview deployment
 * cannot get itself indexed and start competing with the real site — a
 * genuinely awkward problem to unpick after the fact.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Staff area and the auth endpoints.
          "/admin",
          "/api/",
          // Filtered and sorted catalogue permutations. The useful ones are in
          // the sitemap; crawling every combination of sort, page and facet
          // burns the crawl budget on near-duplicate pages.
          "/parts?*sort=",
          "/parts?*page=",
          "/parts?*condition=",
          "/parts?*model=",
          "/parts?*year=",
          // Legacy WordPress paths, which now only exist to 301.
          "/product/",
          "/product-category/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
