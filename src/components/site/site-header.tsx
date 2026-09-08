"use client";

import { Menu, Phone, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export type HeaderLink = { href: string; label: string };

export function SiteHeader({
  links,
  phone,
}: {
  links: HeaderLink[];
  phone: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation, or it stays open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Stop the page scrolling behind the open drawer.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="glass sticky top-0 z-40 border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Car Dress SL — home" className="shrink-0">
          <Wordmark className="h-7 w-auto" />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                isActive(link.href)
                  ? "bg-surface text-foreground"
                  : "text-foreground-muted hover:bg-surface hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/parts"
            aria-label="Search parts"
            className="press grid size-10 place-items-center rounded-lg text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <Search className="size-5" aria-hidden />
          </Link>

          <ThemeToggle variant="icon" />

          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="press hidden h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover sm:inline-flex"
            >
              <Phone className="size-4" aria-hidden />
              {phone}
            </a>
          )}

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="grid size-10 place-items-center rounded-lg text-foreground hover:bg-surface lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-background shadow-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Wordmark className="h-6 w-auto" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid size-10 place-items-center rounded-lg text-foreground-muted hover:bg-surface"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={cn(
                        "block rounded-lg px-3 py-3 text-base font-medium",
                        isActive(link.href)
                          ? "bg-surface text-foreground"
                          : "text-foreground-muted hover:bg-surface hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-border p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                Appearance
              </p>
              <ThemeToggle className="w-full justify-between" />
            </div>

            {phone && (
              <div className="border-t border-border p-3">
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                >
                  <Phone className="size-4" aria-hidden />
                  {phone}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
