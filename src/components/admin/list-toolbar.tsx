"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export type FilterSpec = {
  /** Query-string key. */
  name: string;
  label: string;
  options: FilterOption[];
};

/**
 * Search box and filter selects for an admin list.
 *
 * All state lives in the URL rather than in React state, so a filtered view
 * can be bookmarked, shared with a colleague, or reloaded without loss — and
 * the server component does the filtering, which matters at 700+ products.
 */
export function ListToolbar({
  searchPlaceholder = "Search…",
  filters = [],
}: {
  searchPlaceholder?: string;
  filters?: FilterSpec[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in step when the URL changes from elsewhere (back button,
  // a "clear filters" link).
  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  function push(next: URLSearchParams) {
    // Any change to the result set invalidates the current page number.
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function onSearchChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    // 300ms: long enough not to fire a query per keystroke, short enough that
    // it still feels like live search.
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      push(next);
    }, 300);
  }

  function onFilterChange(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    push(next);
  }

  const activeCount = [...params.keys()].filter(
    (k) => k !== "page" && params.get(k),
  ).length;

  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        isPending && "opacity-60 transition-opacity",
      )}
    >
      <div className="relative flex-1 sm:min-w-64">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={cn(
            "h-11 w-full rounded-lg border border-border bg-surface-raised pl-9 pr-3 text-sm",
            "text-foreground placeholder:text-foreground-subtle focus:border-primary",
          )}
        />
      </div>

      {filters.map((filter) => (
        <label key={filter.name} className="flex items-center gap-2 text-sm">
          <span className="sr-only sm:not-sr-only sm:text-foreground-muted">
            {filter.label}
          </span>
          <select
            value={params.get(filter.name) ?? ""}
            onChange={(e) => onFilterChange(filter.name, e.target.value)}
            aria-label={filter.label}
            className={cn(
              "h-11 rounded-lg border border-border bg-surface-raised px-3 pr-8 text-sm",
              "text-foreground focus:border-primary",
            )}
          >
            <option value="">All</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push(pathname))}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-foreground-muted hover:bg-surface hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}
