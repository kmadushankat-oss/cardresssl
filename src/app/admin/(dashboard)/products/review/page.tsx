import { CheckCircle2, ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import { listProducts, reviewFlagCounts } from "@/lib/queries/products";
import { requirePermission } from "@/lib/session";
import { cn } from "@/lib/utils";

import { MarkReviewedButton } from "./mark-reviewed-button";

export const metadata: Metadata = { title: "Needs review" };

/** Plain-English explanation of each importer flag, and how urgent it is. */
const FLAG_INFO: Record<
  string,
  { label: string; help: string; tone: "warning" | "danger" | "info" }
> = {
  "not-a-product": {
    label: "Not a product",
    help: "These look like invoice lines rather than things you sell — carried-forward balances, supplier names, fuel. They are hidden from the website. Delete them, or correct the name if one is genuinely a product.",
    tone: "danger",
  },
  "possible-service": {
    label: "Might be a service",
    help: "The name reads like labour rather than a part, but it scored as a part. Confirm which it is.",
    tone: "warning",
  },
  uncategorised: {
    label: "No category",
    help: "The importer could not work out where these belong from the name alone. Pick a category so customers can browse to them.",
    tone: "warning",
  },
  "no-price": {
    label: "No price",
    help: "These had no price on the old site, so they are hidden from the website until you set one.",
    tone: "warning",
  },
  "no-image": {
    label: "No photo",
    help: "The old site had only two images in total, both theme placeholders. Every product needs a real photo.",
    tone: "info",
  },
  "no-description": {
    label: "No description",
    help: "Nothing to read on the product page. Worth writing for your best sellers first.",
    tone: "info",
  },
  "low-confidence-category": {
    label: "Unsure of category",
    help: "A category was guessed, but not confidently. Check it is right.",
    tone: "warning",
  },
  "reclassified-as-service-or-removed-upstream": {
    label: "Retired by a re-import",
    help: "A later import no longer treats these as products — usually because they became services. They are deactivated, not deleted.",
    tone: "info",
  },
};

export default async function ReviewQueuePage({
  searchParams,
}: PageProps<"/admin/products/review">) {
  await requirePermission("product:update");
  const params = await searchParams;

  const flag = typeof params.flag === "string" ? params.flag : undefined;
  const page = Number.parseInt(
    typeof params.page === "string" ? params.page : "1",
    10,
  ) || 1;

  const [result, flags] = await Promise.all([
    // Least-confident first, so the worst guesses get looked at soonest.
    listProducts({ review: "yes", flag, sort: "review", page }),
    reviewFlagCounts(),
  ]);

  const active = flag ? FLAG_INFO[flag] : undefined;

  const buildHref = (nextPage: number) => {
    const qs = new URLSearchParams();
    if (flag) qs.set("flag", flag);
    if (nextPage > 1) qs.set("page", String(nextPage));
    const s = qs.toString();
    return s ? `/admin/products/review?${s}` : "/admin/products/review";
  };

  return (
    <div>
      <PageHeader
        title="Needs review"
        description="Everything the WooCommerce import could not finish on its own. Work through a category at a time."
      />

      {/* Flag filters */}
      <nav aria-label="Filter by issue" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          <li>
            <FilterChip href="/admin/products/review" active={!flag}>
              All issues
            </FilterChip>
          </li>
          {flags.map(({ flag: name, count }) => (
            <li key={name}>
              <FilterChip
                href={`/admin/products/review?flag=${encodeURIComponent(name)}`}
                active={flag === name}
              >
                {FLAG_INFO[name]?.label ?? name}
                <span className="ml-1 tabular-nums opacity-70">{count}</span>
              </FilterChip>
            </li>
          ))}
        </ul>
      </nav>

      {active && (
        <div
          className={cn(
            "mb-4 rounded-lg border p-3 text-sm",
            active.tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
            active.tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
            active.tone === "info" && "border-border bg-surface text-foreground-muted",
          )}
        >
          {active.help}
        </div>
      )}

      {result.items.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success/10">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
          </div>
          <h2 className="font-display font-semibold">Nothing left to review</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {flag ? "No products carry this issue any more." : "The whole queue is clear."}
          </p>
        </div>
      ) : (
        <>
          <ul className="mb-4 space-y-3">
            {result.items.map((product) => {
              const reasons = product.reviewReason?.split(", ").filter(Boolean) ?? [];
              const image = product.images[0];

              return (
                <li
                  key={product.id}
                  className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4 sm:flex-row sm:items-center"
                >
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface">
                    {image ? (
                      <Image
                        src={image.url}
                        alt={image.alt ?? ""}
                        width={48}
                        height={48}
                        className="size-12 object-cover"
                      />
                    ) : (
                      <ImageOff className="size-4 text-foreground-subtle" aria-hidden />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-foreground-subtle">
                      <span className="font-mono">{product.sku}</span>
                      <span>·</span>
                      <span>
                        {product.category
                          ? [product.category.parent?.name, product.category.name]
                              .filter(Boolean)
                              .join(" · ")
                          : "Uncategorised"}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {Number(product.price) > 0
                          ? formatPrice(product.price)
                          : "No price"}
                      </span>
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {reasons.map((reason) => (
                        <li key={reason}>
                          <Badge tone={FLAG_INFO[reason]?.tone ?? "neutral"}>
                            {FLAG_INFO[reason]?.label ?? reason}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm hover:bg-surface"
                    >
                      Edit
                    </Link>
                    <MarkReviewedButton id={product.id} name={product.name} />
                  </div>
                </li>
              );
            })}
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

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors",
        active
          ? "border-primary bg-primary/12 font-medium text-primary-text"
          : "border-border text-foreground-muted hover:bg-surface hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
