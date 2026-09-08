import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables unauthorized() / forbidden() from next/navigation, which the
    // RBAC guards in src/lib/session.ts rely on.
    authInterrupts: true,
  },

  images: {
    remotePatterns: [
      // Vercel Blob — where product images live in production.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // The old WordPress site, so migrated images render before they have
      // been re-hosted. Removed once the migration is complete.
      { protocol: "https", hostname: "cardresssl.com" },
    ],
    formats: ["image/webp"],
  },

  // sharp is a native module; keep it out of the bundler's hands.
  serverExternalPackages: ["sharp"],

  typescript: {
    // Never ship a build that does not typecheck.
    ignoreBuildErrors: false,
  },

  /**
   * Legacy WooCommerce pages with a fixed destination.
   *
   * These four are the only non-product pages the old site had, and their
   * mapping never changes — so they belong here rather than in the database.
   * Declared statically they are served at the edge with no database round
   * trip, which matters because `/shop` was the old site's busiest page.
   *
   * The ~949 per-product and per-category URLs are data, not config: they live
   * in the `Redirect` table and are served by the route handlers under
   * `src/app/product/` so the client can edit them from the admin.
   */
  async redirects() {
    /*
     * `statusCode: 301` rather than `permanent: true`, which emits 308.
     *
     * Google treats 301 and 308 alike, but the database-driven redirects under
     * src/app/product/ return a literal 301, and having the two halves of the
     * migration disagree is the sort of thing that shows up in an SEO audit as
     * a finding to chase. One status code everywhere.
     */
    return [
      { source: "/shop", destination: "/parts", statusCode: 301 },
      // WooCommerce's paginated shop, e.g. /shop/page/7
      { source: "/shop/page/:page", destination: "/parts", statusCode: 301 },
      // No online payment in v1, so a cart or checkout link becomes an enquiry.
      { source: "/cart", destination: "/parts", statusCode: 301 },
      { source: "/checkout", destination: "/contact", statusCode: 301 },
      { source: "/my-account", destination: "/contact", statusCode: 301 },
      { source: "/my-account/:path*", destination: "/contact", statusCode: 301 },
      // WordPress leftovers that would otherwise 404 noisily in the logs.
      // Temporary on purpose: these are conveniences, not canonical moves.
      { source: "/wp-admin", destination: "/admin", statusCode: 302 },
      { source: "/wp-login.php", destination: "/admin/sign-in", statusCode: 302 },
    ];
  },
};

export default nextConfig;
