"use client";

import { icons, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import type { NavSection } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

/** Resolve a kebab-case icon name from the nav data to a Lucide component. */
function Icon({ name, className }: { name: string; className?: string }) {
  const pascal = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const Cmp = (icons as Record<string, React.ComponentType<{ className?: string }>>)[
    pascal
  ];
  if (!Cmp) return <span className={className} aria-hidden />;
  return <Cmp className={className} />;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  sections,
  children,
}: {
  sections: NavSection[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Navigating on mobile should dismiss the drawer.
  useEffect(() => setOpen(false), [pathname]);

  // Close on Escape, the behaviour a keyboard user expects from a drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title} className="mb-6 last:mb-0">
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
            {section.title}
          </h2>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-disabled={item.comingSoon || undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-brand-500/15 font-medium text-brand-300"
                        : "text-ink-200 hover:bg-ink-800 hover:text-white",
                      item.comingSoon && "pointer-events-none opacity-45",
                    )}
                  >
                    <Icon name={item.icon} className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.comingSoon && (
                      <span className="ml-auto rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-300">
                        Soon
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="-ml-2 grid size-11 place-items-center rounded-lg text-foreground hover:bg-surface"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="font-display font-semibold">Car Dress SL</span>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-950/70"
          />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-ink-950">
            <div className="flex h-14 items-center justify-between border-b border-ink-800 px-4">
              <Wordmark tone="light" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid size-10 place-items-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {nav}
            <div className="border-t border-ink-800 p-3">{children}</div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:bg-ink-950">
        <div className="flex h-16 items-center border-b border-ink-800 px-5">
          <Link href="/admin" className="flex items-center">
            <Wordmark tone="light" />
          </Link>
        </div>
        {nav}
        <div className="border-t border-ink-800 p-3">{children}</div>
      </div>
    </>
  );
}
