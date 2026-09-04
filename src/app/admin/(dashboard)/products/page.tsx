import { AlertTriangle, ImageOff, Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ListToolbar } from "@/components/admin/list-toolbar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import { can } from "@/lib/permissions";
import {
  categoryOptions,
  listProducts,
  type ProductListItem,
  type ProductSort,
} from "@/lib/queries/products";
import { requirePermission } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "name", label: "Name A–Z" },
  { value: "price-asc", label: "Price low to high" },
  { value: "price-desc", label: "Price high to low" },
  { value: "review", label: "Least confident first" },
];

const CONDITIONS = ["NEW", "USED", "REFURBISHED", "OEM", "AFTERMARKET"];

export default async function ProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  const user = await requirePermission("product:view");
  const params = await searchParams;

  const str = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const query = {
    q: str("q"),
    categoryId: str("category"),
    status: str("status") as "active" | "inactive" | undefined,
    review: str("review") as "yes" | "no" | undefined,
    condition: str("condition"),
    flag: str("flag"),
    sort: (str("sort") as ProductSort) ?? "recent",
    page: Number.parseInt(str("page") ?? "1", 10) || 1,
  };

  const [result, categories] = await Promise.all([
    listProducts(query),
    categoryOptions(),
  ]);

  const showCost = can(user.role, "product:viewCost");
  const canEdit = can(user.role, "product:update");

  // Preserve every filter when paging.
  const buildHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    const qs = next.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${result.total.toLocaleString("en-LK")} in the catalogue`}
        actions={
          can(user.role, "product:create") && (
            <Link
              href="/admin/products/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Plus className="size-4" aria-hidden />
              New product
            </Link>
          )
        }
      />

      <ListToolbar
        searchPlaceholder="Search name, SKU or part number…"
        filters={[
          { name: "category", label: "Category", options: categories },
          {
            name: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
          {
            name: "review",
            label: "Review",
            options: [
              { value: "yes", label: "Needs review" },
              { value: "no", label: "Reviewed" },
            ],
          },
          {
            name: "condition",
            label: "Condition",
            options: CONDITIONS.map((c) => ({
              value: c,
              label: c.charAt(0) + c.slice(1).toLowerCase(),
            })),
          },
          { name: "sort", label: "Sort", options: SORTS },
        ]}
      />

      {result.items.length === 0 ? (
        <EmptyState hasFilters={Object.keys(params).length > 0} />
      ) : (
        <>
          {/* Table on desktop. The wrapper scrolls horizontally so a narrow
              window shifts the table's own overflow rather than the page. */}
          <div className="mb-4 hidden rounded-card border border-border bg-surface-raised md:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-border bg-surface text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Price
                  </th>
                  {showCost && (
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Cost
                    </th>
                  )}
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-surface"
                  >
                    <td className="px-4 py-3">
                      <ProductCell product={product} canEdit={canEdit} />
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      <CategoryLabel product={product} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <PriceCell product={product} />
                    </td>
                    {showCost && (
                      <td className="px-4 py-3 text-right tabular-nums text-foreground-muted">
                        {Number(product.costPrice) > 0
                          ? formatPrice(product.costPrice)
                          : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <StatusCell product={product} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Cards on mobile */}
          <ul className="mb-4 space-y-3 md:hidden">
            {result.items.map((product) => (
              <li
                key={product.id}
                className="rounded-card border border-border bg-surface-raised p-4"
              >
                <ProductCell product={product} canEdit={canEdit} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-foreground-muted">
                    <CategoryLabel product={product} />
                  </span>
                  <span className="tabular-nums">
                    <PriceCell product={product} />
                  </span>
                </div>
                <div className="mt-2">
                  <StatusCell product={product} />
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={buildHref}
          />
        </>
      )}
    </div>
  );
}

function ProductCell({
  product,
  canEdit,
}: {
  product: ProductListItem;
  canEdit: boolean;
}) {
  const image = product.images[0];

  const inner = (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? ""}
            width={40}
            height={40}
            className="size-10 object-cover"
          />
        ) : (
          <ImageOff className="size-4 text-foreground-subtle" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{product.name}</p>
        <p className="truncate font-mono text-xs text-foreground-subtle">
          {product.sku}
        </p>
      </div>
    </div>
  );

  if (!canEdit) return inner;

  return (
    <Link
      href={`/admin/products/${product.id}`}
      className="block rounded-md hover:underline"
    >
      {inner}
    </Link>
  );
}

function CategoryLabel({ product }: { product: ProductListItem }) {
  if (!product.category) {
    return <span className="text-warning">Uncategorised</span>;
  }
  const parent = product.category.parent?.name;
  return (
    <span className="truncate">
      {parent ? `${parent} · ` : ""}
      {product.category.name}
    </span>
  );
}

function PriceCell({ product }: { product: ProductListItem }) {
  const price = Number(product.price);
  if (price <= 0) return <span className="text-warning">No price</span>;

  const discounted = product.discountedPrice ? Number(product.discountedPrice) : null;
  if (discounted && discounted < price) {
    return (
      <span className="whitespace-nowrap">
        <span className="font-medium">{formatPrice(discounted)}</span>{" "}
        <s className="text-foreground-subtle">{formatPrice(price)}</s>
      </span>
    );
  }
  return <span className="font-medium">{formatPrice(price)}</span>;
}

function StatusCell({ product }: { product: ProductListItem }) {
  const reasons = product.reviewReason?.split(", ").filter(Boolean) ?? [];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={product.isActive ? "success" : "neutral"}>
        {product.isActive ? "Active" : "Inactive"}
      </Badge>
      {product.needsReview && (
        <Badge tone="warning" title={product.reviewReason ?? undefined}>
          <AlertTriangle className="size-3" aria-hidden />
          {reasons.length > 1 ? `${reasons.length} issues` : (reasons[0] ?? "Review")}
        </Badge>
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-border bg-surface-raised",
        "px-6 py-16 text-center",
      )}
    >
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface">
        <Package className="size-5 text-foreground-muted" aria-hidden />
      </div>
      <h2 className="font-display font-semibold">
        {hasFilters ? "No products match those filters" : "No products yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-foreground-muted">
        {hasFilters ? (
          "Try clearing a filter or searching for something broader."
        ) : (
          <>
            Import the existing catalogue with{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-xs">
              npm run import:woo
            </code>
            , or add a product by hand.
          </>
        )}
      </p>
    </div>
  );
}
