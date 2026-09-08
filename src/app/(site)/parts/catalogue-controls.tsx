"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { CatalogueSort } from "@/lib/queries/catalogue";
import { cn } from "@/lib/utils";

/** Debounced search box that keeps its state in the URL. */
export function CatalogueSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(params.get("q") ?? "");
  }, [params]);

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const search = new URLSearchParams(params.toString());
      if (next.trim()) search.set("q", next.trim());
      else search.delete("q");
      search.delete("page");
      const qs = search.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    }, 300);
  }

  return (
    <div className={cn("relative flex-1", isPending && "opacity-70")}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search parts or part numbers…"
        aria-label="Search parts"
        className="h-12 w-full rounded-lg border border-border bg-surface-raised pl-9 pr-3 text-base focus:border-primary sm:text-sm"
      />
    </div>
  );
}

export function SortSelect({
  sorts,
}: {
  sorts: { value: CatalogueSort; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <label className="text-sm">
      <span className="sr-only">Sort by</span>
      <select
        value={params.get("sort") ?? "relevant"}
        onChange={(e) => {
          const search = new URLSearchParams(params.toString());
          if (e.target.value === "relevant") search.delete("sort");
          else search.set("sort", e.target.value);
          search.delete("page");
          const qs = search.toString();
          startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
        }}
        className="h-12 w-full rounded-lg border border-border bg-surface-raised px-3 pr-8 text-sm focus:border-primary sm:w-auto"
      >
        {sorts.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
    </label>
  );
}
