"use client";

import { Car, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

/**
 * "Find parts for your vehicle" — make, model, year.
 *
 * This is the feature the whole catalogue turns on. The reference site records
 * fitment data against every product and then gives customers no way to search
 * it, leaving them to page through 3,512 items. Choosing a vehicle here filters
 * to only the parts that actually fit.
 */
export function FitmentPicker({
  makes,
  models,
  selected,
  className,
}: {
  makes: string[];
  models: string[];
  selected: { make?: string; model?: string; year?: number };
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // A sensible span for vehicles on Sri Lankan roads, newest first.
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 36 }, (_, i) => currentYear - i);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const hasSelection = Boolean(selected.make);

  return (
    <section
      aria-labelledby="fitment-heading"
      className={cn(
        "rounded-card border border-border bg-surface-raised p-4",
        isPending && "opacity-70",
        className,
      )}
    >
      <h2
        id="fitment-heading"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <Car className="size-4 text-primary" aria-hidden />
        Find parts for your vehicle
      </h2>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">Make</span>
          <select
            value={selected.make ?? ""}
            onChange={(e) =>
              // Changing make invalidates the chosen model.
              update({ make: e.target.value, model: "" })
            }
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary"
          >
            <option value="">Any make</option>
            {makes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">Model</span>
          <select
            value={selected.model ?? ""}
            onChange={(e) => update({ model: e.target.value })}
            disabled={!selected.make || models.length === 0}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary disabled:opacity-50"
          >
            <option value="">
              {selected.make
                ? models.length
                  ? "Any model"
                  : "No models recorded"
                : "Choose a make first"}
            </option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-foreground-muted">Year</span>
          <select
            value={selected.year?.toString() ?? ""}
            onChange={(e) => update({ year: e.target.value })}
            disabled={!selected.make}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary disabled:opacity-50"
          >
            <option value="">Any year</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasSelection && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-foreground-muted">
            Showing parts that fit{" "}
            <strong className="text-foreground">
              {[selected.make, selected.model, selected.year].filter(Boolean).join(" ")}
            </strong>
          </p>
          <button
            type="button"
            onClick={() => update({ make: "", model: "", year: "" })}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-foreground-muted hover:bg-surface hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Clear vehicle
          </button>
        </div>
      )}

      {makes.length === 0 && (
        // Honest empty state: no fitment data has been entered yet.
        <p className="mt-3 text-sm text-foreground-subtle">
          Vehicle compatibility has not been recorded yet. Call or WhatsApp us
          with your vehicle details and we will confirm the right part.
        </p>
      )}
    </section>
  );
}
