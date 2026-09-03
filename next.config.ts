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
};

export default nextConfig;
