import type { ReactNode } from "react";

import { MobileContactBar, SiteFooter } from "@/components/site/site-footer";
import { SiteHeader, type HeaderLink } from "@/components/site/site-header";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

const LINKS: HeaderLink[] = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/parts", label: "Spare parts" },
  { href: "/book", label: "Book a service" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [settings, partCategories, serviceCategories] = await Promise.all([
    getSettings(),
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true },
    }),
    db.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, slug: true },
    }),
  ]);

  return (
    <>
      <SiteHeader links={LINKS} phone={settings["contact.phone"] || null} />

      {/* Bottom padding leaves room for the fixed mobile call bar. */}
      <main id="main" className="min-h-[60vh] pb-20 lg:pb-0">
        {children}
      </main>

      <SiteFooter
        settings={settings}
        partCategories={partCategories}
        serviceCategories={serviceCategories}
      />

      <MobileContactBar settings={settings} />
    </>
  );
}
