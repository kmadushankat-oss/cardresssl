import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Page navigation for the admin lists.
 *
 * Links rather than buttons, so the current view is a real URL a member of
 * staff can bookmark or share, and so it works before JavaScript loads.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Given a page number, return the href for it. */
  buildHref: (page: number) => string;
}) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-foreground-muted" aria-live="polite">
        Showing <span className="font-medium text-foreground">{first}</span>–
        <span className="font-medium text-foreground">{last}</span> of{" "}
        <span className="font-medium text-foreground">{total.toLocaleString("en-LK")}</span>
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <PageLink
            href={buildHref(page - 1)}
            disabled={page <= 1}
            label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">Previous</span>
          </PageLink>

          <span className="px-2 text-sm text-foreground-muted tabular-nums">
            {page} / {pageCount}
          </span>

          <PageLink
            href={buildHref(page + 1)}
            disabled={page >= pageCount}
            label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" aria-hidden />
          </PageLink>
        </div>
      )}
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const classes = cn(
    "inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm",
    disabled
      ? "cursor-not-allowed text-foreground-subtle opacity-50"
      : "text-foreground hover:bg-surface",
  );

  // A disabled control must not be a link at all, or keyboard users can still
  // tab to it and navigate past the last page.
  if (disabled) {
    return (
      <span className={classes} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={classes}>
      {children}
    </Link>
  );
}
