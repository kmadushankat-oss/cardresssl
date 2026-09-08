import { PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FitmentPicker } from "@/components/site/fitment-picker";
import { ProductCard } from "@/components/site/product-card";
import { Pagination } from "@/components/admin/pagination";
import {
  catalogueFacets,
  fitmentOptions,
  listCatalogue,
  type CatalogueSort,
} from "@/lib/queries/catalogue";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

import { CatalogueSearch, SortSelect } from "./catalogue-controls";

export const metadata: Metadata = {
  title: "Spare parts",
  description:
    "Genuine and aftermarket vehicle spare parts. Search by part number or find what fits your vehicle.",
};

const SORTS: { value: CatalogueSort; label: string }[] = [
  { value: "relevant", label: "Most relevant" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
];

const CONDITION_LABELS: Record<string, string> = {
  NEW: "New",
  USED: "Used",
  REFURBISHED: "Reconditioned",
  OEM: "Genuine / OEM",
  AFTERMARKET: "Aftermarket",
};

export default async function PartsPage({ searchParams }: PageProps<"/parts">) {
  const params = await searchParams;

  const str = (key: string) =>
    typeof params[key] === "string" && params[key] ? (params[key] as string) : undefined;

  const query = {
    q: str("q"),
    category: str("category"),
    brand: str("brand"),
    condition: str("condition"),
    make: str("make"),
    model: str("model"),
    year: str("year") ? Number.parseInt(str("year")!, 10) : undefined,
    inStock: str("inStock") === "1",
    sort: (str("sort") as CatalogueSort) ?? "relevant",
    page: Number.parseInt(str("page") ?? "1", 10) || 1,
  };

  const [result, facets, fitment, settings] = await Promise.all([
    listCatalogue(query),
    catalogueFacets(query),
    fitmentOptions(query.make),
    getSettings(),
  ]);

  /** Rebuild the URL, changing one parameter and resetting the page. */
  const hrefWith = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const qs = next.toString();
    return qs ? `/parts?${qs}` : "/parts";
  };

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    const qs = next.toString();
    return qs ? `/parts?${qs}` : "/parts";
  };

  const activeFilters = [
    query.category && { label: facets.categories.find((c) => c.slug === query.category)?.name ?? query.category, href: hrefWith({ category: undefined }) },
    query.brand && { label: facets.brands.find((b) => b.slug === query.brand)?.name ?? query.brand, href: hrefWith({ brand: undefined }) },
    query.condition && { label: CONDITION_LABELS[query.condition] ?? query.condition, href: hrefWith({ condition: undefined }) },
    query.inStock && { label: "In stock", href: hrefWith({ inStock: undefined }) },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Spare parts</h1>
        <p className="mt-1 text-foreground-muted">
          {result.total.toLocaleString("en-LK")} parts in stock across{" "}
          {facets.categories.length} categories. Search by name or part number.
        </p>
      </header>

      <FitmentPicker
        makes={fitment.makes}
        models={fitment.models}
        selected={{ make: query.make, model: query.model, year: query.year }}
        className="mb-6"
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <CatalogueSearch />
        <SortSelect sorts={SORTS} />
      </div>

      {activeFilters.length > 0 && (
        <ul className="mb-4 flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <li key={filter.label}>
              <Link
                href={filter.href}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm hover:bg-surface-raised"
              >
                {filter.label}
                <span aria-hidden>×</span>
                <span className="sr-only">Remove this filter</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/parts"
              className="text-sm text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear all
            </Link>
          </li>
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Facets */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <details className="responsive-disclosure rounded-card border border-border bg-surface-raised">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold lg:hidden">
              Filters
            </summary>

            <div className="space-y-5 p-4 pt-0 lg:pt-4">
              <nav aria-labelledby="facet-categories">
                <h2 id="facet-categories" className="mb-2 text-sm font-semibold">
                  Category
                </h2>
                <ul className="space-y-1 text-sm">
                  {facets.categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={hrefWith({ category: category.slug })}
                        aria-current={query.category === category.slug ? "true" : undefined}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded px-1 py-1",
                          query.category === category.slug
                            ? "font-medium text-primary-text"
                            : "text-foreground-muted hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{category.name}</span>
                        <span className="shrink-0 text-xs text-foreground-subtle tabular-nums">
                          {category.count}
                        </span>
                      </Link>

                      {query.category === category.slug && category.children.length > 0 && (
                        <ul className="mb-1 ml-3 mt-1 space-y-0.5 border-l border-border pl-3">
                          {category.children.map((child) => (
                            <li key={child.slug}>
                              <Link
                                href={hrefWith({ category: child.slug })}
                                className="flex items-center justify-between gap-2 py-0.5 text-foreground-muted hover:text-foreground"
                              >
                                <span className="truncate">{child.name}</span>
                                <span className="shrink-0 text-xs text-foreground-subtle tabular-nums">
                                  {child.count}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              {facets.brands.length > 0 && (
                <nav aria-labelledby="facet-brands">
                  <h2 id="facet-brands" className="mb-2 text-sm font-semibold">
                    Brand
                  </h2>
                  <ul className="space-y-1 text-sm">
                    {facets.brands.map((brand) => (
                      <li key={brand.slug}>
                        <Link
                          href={hrefWith({ brand: brand.slug })}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded px-1 py-1",
                            query.brand === brand.slug
                              ? "font-medium text-primary-text"
                              : "text-foreground-muted hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{brand.name}</span>
                          <span className="shrink-0 text-xs text-foreground-subtle tabular-nums">
                            {brand.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              {facets.conditions.length > 1 && (
                <nav aria-labelledby="facet-condition">
                  <h2 id="facet-condition" className="mb-2 text-sm font-semibold">
                    Condition
                  </h2>
                  <ul className="space-y-1 text-sm">
                    {facets.conditions.map((condition) => (
                      <li key={condition.value}>
                        <Link
                          href={hrefWith({ condition: condition.value })}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded px-1 py-1",
                            query.condition === condition.value
                              ? "font-medium text-primary-text"
                              : "text-foreground-muted hover:text-foreground",
                          )}
                        >
                          <span>{CONDITION_LABELS[condition.value] ?? condition.value}</span>
                          <span className="shrink-0 text-xs text-foreground-subtle tabular-nums">
                            {condition.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </div>
          </details>
        </aside>

        {/* Results */}
        <div>
          {result.items.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface">
                <PackageSearch className="size-5 text-foreground-muted" aria-hidden />
              </div>
              <h2 className="text-lg font-semibold">No parts match that</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-foreground-muted">
                Try a broader search, or clear the vehicle filter. We stock far more
                than is listed online — if you cannot find it, ask us.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href="/parts"
                  className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface"
                >
                  Clear filters
                </Link>
                {settings["contact.whatsapp"] && (
                  <Link
                    href="/contact"
                    className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                  >
                    Ask us for a part
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {result.items.map((product, index) => (
                  <li key={product.id}>
                    <ProductCard product={product} priority={index < 4} />
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Pagination
                  page={result.page}
                  pageCount={result.pageCount}
                  total={result.total}
                  pageSize={result.pageSize}
                  buildHref={pageHref}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
