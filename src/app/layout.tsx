import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

import { ThemeScript } from "@/components/theme-script";

import "./globals.css";

/*
 * Three faces, each doing a job.
 *
 * Space Grotesk for headings: geometric and slightly mechanical, which suits a
 * workshop far better than a neutral grotesque. Plus Jakarta Sans for body
 * copy — warmer and rounder than Inter, and it holds up at the small sizes the
 * spec tables use. JetBrains Mono for SKUs, part numbers and registrations,
 * where the digits actually need to be unambiguous: a customer reading
 * "11532247154" down the phone must not confuse 1 and l, or 0 and O.
 *
 * All self-hosted by next/font at build time, so there is no render-blocking
 * request to Google and no layout shift.
 */
const display = Space_Grotesk({
  variable: "--ff-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const body = Plus_Jakarta_Sans({
  variable: "--ff-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--ff-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://cardresssl.com"),
  title: {
    default: "Car Dress SL — Vehicle Service Centre & Auto Spare Parts",
    template: "%s | Car Dress SL",
  },
  description:
    "Full-service vehicle care in Sri Lanka — servicing, mechanical repairs, body work, detailing and genuine spare parts.",
  openGraph: {
    type: "website",
    siteName: "Car Dress SL",
    locale: "en_LK",
  },
  robots: {
    // Flipped on at launch; keeps the staging deployment out of search results.
    index: process.env.NODE_ENV === "production",
    follow: process.env.NODE_ENV === "production",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
