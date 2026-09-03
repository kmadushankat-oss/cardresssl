import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";

import { ThemeScript } from "@/components/theme-script";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Used for headings only — a little more character than the body face.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
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
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
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
