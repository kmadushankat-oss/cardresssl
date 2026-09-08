import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import type { Settings } from "@/lib/settings";
import { toWhatsAppNumber } from "@/lib/utils";

const SOCIALS = [
  { key: "social.facebook", label: "Facebook" },
  { key: "social.instagram", label: "Instagram" },
  { key: "social.tiktok", label: "TikTok" },
  { key: "social.youtube", label: "YouTube" },
] as const;

export function SiteFooter({
  settings,
  partCategories,
  serviceCategories,
}: {
  settings: Settings;
  partCategories: { name: string; slug: string }[];
  serviceCategories: { name: string; slug: string }[];
}) {
  const address = [
    settings["contact.addressLine1"],
    settings["contact.addressLine2"],
    settings["contact.city"],
  ]
    .filter(Boolean)
    .join(", ");

  const hours = [
    { label: "Mon – Fri", value: settings["hours.weekday"] },
    { label: "Saturday", value: settings["hours.saturday"] },
    { label: "Sunday", value: settings["hours.sunday"] },
  ].filter((h) => h.value);

  const socials = SOCIALS.filter((s) => settings[s.key]);

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Wordmark className="h-7 w-auto" />
            {settings["site.tagline"] && (
              <p className="mt-3 text-sm text-foreground-muted">
                {settings["site.tagline"]}
              </p>
            )}

            {socials.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-3">
                {socials.map((social) => (
                  <li key={social.key}>
                    <a
                      href={settings[social.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {serviceCategories.length > 0 && (
            <nav aria-labelledby="footer-services">
              <h2 id="footer-services" className="text-sm font-semibold">
                Services
              </h2>
              <ul className="mt-3 space-y-2">
                {serviceCategories.slice(0, 6).map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/services#${category.slug}`}
                      className="text-sm text-foreground-muted hover:text-foreground"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/book"
                    className="text-sm font-medium text-primary-text hover:underline"
                  >
                    Book a service
                  </Link>
                </li>
              </ul>
            </nav>
          )}

          {partCategories.length > 0 && (
            <nav aria-labelledby="footer-parts">
              <h2 id="footer-parts" className="text-sm font-semibold">
                Spare parts
              </h2>
              <ul className="mt-3 space-y-2">
                {partCategories.slice(0, 6).map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/parts?category=${category.slug}`}
                      className="text-sm text-foreground-muted hover:text-foreground"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/parts"
                    className="text-sm font-medium text-primary-text hover:underline"
                  >
                    All parts
                  </Link>
                </li>
              </ul>
            </nav>
          )}

          <div>
            <h2 className="text-sm font-semibold">Get in touch</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {settings["contact.phone"] && (
                <li>
                  <a
                    href={`tel:${settings["contact.phone"].replace(/\s/g, "")}`}
                    className="flex items-start gap-2 text-foreground-muted hover:text-foreground"
                  >
                    <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {settings["contact.phone"]}
                  </a>
                </li>
              )}
              {settings["contact.email"] && (
                <li>
                  <a
                    href={`mailto:${settings["contact.email"]}`}
                    className="flex items-start gap-2 break-all text-foreground-muted hover:text-foreground"
                  >
                    <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {settings["contact.email"]}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-2 text-foreground-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{address}</span>
                </li>
              )}
              {hours.length > 0 && (
                <li className="flex items-start gap-2 text-foreground-muted">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {hours.map((h) => (
                      <span key={h.label} className="block">
                        {h.label}: {h.value}
                      </span>
                    ))}
                    {settings["hours.note"] && (
                      <span className="block text-foreground-subtle">
                        {settings["hours.note"]}
                      </span>
                    )}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm text-foreground-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings["site.name"] || "Car Dress SL"}. All
            rights reserved.
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-4">
              <li>
                <Link href="/about" className="hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

/**
 * Call and WhatsApp, fixed to the bottom on phones.
 *
 * A workshop customer is almost always on a phone and wants to talk to someone,
 * not read. Keeping both one thumb away is the single highest-value thing on a
 * small screen — the reference site buries its number in the header.
 */
export function MobileContactBar({ settings }: { settings: Settings }) {
  const phone = settings["contact.phone"];
  const whatsapp = settings["contact.whatsapp"];

  if (!phone && !whatsapp) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="flex items-stretch gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {phone && (
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            <Phone className="size-4" aria-hidden />
            Call us
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${toWhatsAppNumber(whatsapp)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised text-sm font-semibold text-foreground"
          >
            {/* Brand glyph, so it is recognisable at a glance. */}
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.17-.3-.02-.46.13-.61.15-.15.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.9-2.19-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.5.07-.77.37-.27.3-1.02.99-1.02 2.42 0 1.43 1.04 2.81 1.19 3.01.15.2 2.05 3.28 5.05 4.47 2.5.99 3.01.79 3.55.74.54-.05 1.75-.72 2-1.41.24-.7.24-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
              <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.41 1.27 4.85L2 22l5.31-1.39c1.38.75 2.96 1.18 4.64 1.18h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm.01 18.13c-1.5 0-2.9-.4-4.11-1.11l-.29-.17-3.05.8.81-2.98-.19-.31a8.14 8.14 0 0 1-1.25-4.36c0-4.51 3.67-8.17 8.18-8.17 4.51 0 8.17 3.66 8.17 8.17 0 4.51-3.66 8.17-8.17 8.17Z" />
            </svg>
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
