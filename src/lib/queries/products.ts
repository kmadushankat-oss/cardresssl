import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const PRODUCTS_PAGE_SIZE = 25;

export type ProductSort =
  | "recent"
  | "name"
  | "price-asc"
  | "price-desc"
  | "review";

export type ProductListParams = {
  q?: string;
  categoryId?: string;
  status?: "active" | "inactive";
  review?: "yes" | "no";
  condition?: string;
  flag?: string;
  sort?: ProductSort;
  page?: number;
};

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  recent: [{ updatedAt: "desc" }],
  name: [{ name: "asc" }],
  "price-asc": [{ price: "asc" }],
  "price-desc": [{ price: "desc" }],
  // Worst-first: least confident classifications at the top of the queue.
  review: [{ classifyConfidence: "asc" }, { name: "asc" }],
};

/**
 * Compose the filters as a list of AND'ed clauses.
 *
 * Each filter contributes its own clause rather than assigning onto a shared
 * `OR` key. Two of these filters (search and category) each need their own
 * `OR`, and writing both to `where.OR` means the second silently replaces the
 * first — so searching *within* a category quietly ignored the search term.
 */
export function buildProductWhere(params: ProductListParams): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [];

  if (params.q?.trim()) {
    const q = params.q.trim();
    // Search what staff actually have to hand: the name, the SKU we minted, or
    // the manufacturer's part number off the old box.
    clauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { partNumber: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (params.categoryId) {
    // Include the subtree, so picking "Brakes" also returns brake pads.
    clauses.push({
      OR: [
        { categoryId: params.categoryId },
        { category: { parentId: params.categoryId } },
      ],
    });
  }

  if (params.status === "active") clauses.push({ isActive: true });
  if (params.status === "inactive") clauses.push({ isActive: false });

  if (params.review === "yes") clauses.push({ needsReview: true });
  if (params.review === "no") clauses.push({ needsReview: false });

  if (params.condition) {
    clauses.push({
      condition: params.condition as Prisma.ProductWhereInput["condition"],
    });
  }

  // The importer stores its reasons as a comma-separated list, which is enough
  // to filter the review queue down to one specific problem.
  if (params.flag) {
    clauses.push({ reviewReason: { contains: params.flag, mode: "insensitive" } });
  }

  return clauses.length ? { AND: clauses } : {};
}

export async function listProducts(params: ProductListParams) {
  const page = Math.max(1, params.page ?? 1);
  const where = buildProductWhere(params);
  const orderBy = ORDER_BY[params.sort ?? "recent"];

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PRODUCTS_PAGE_SIZE,
      take: PRODUCTS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        sku: true,
        slug: true,
        price: true,
        discountedPrice: true,
        costPrice: true,
        stockQty: true,
        trackInventory: true,
        lowStockThreshold: true,
        condition: true,
        isActive: true,
        needsReview: true,
        reviewReason: true,
        classifyConfidence: true,
        updatedAt: true,
        category: { select: { id: true, name: true, parent: { select: { name: true } } } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, alt: true },
        },
      },
    }),
    db.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize: PRODUCTS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE)),
  };
}

export type ProductListItem = Awaited<ReturnType<typeof listProducts>>["items"][number];

/** Category tree flattened for a filter dropdown, with indentation. */
export async function categoryOptions() {
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });

  const roots = categories.filter((c) => !c.parentId);
  const options: { value: string; label: string }[] = [];

  for (const root of roots) {
    options.push({ value: root.id, label: root.name });
    for (const child of categories.filter((c) => c.parentId === root.id)) {
      options.push({ value: child.id, label: `— ${child.name}` });
    }
  }
  return options;
}

/** How many products carry each importer review flag, for the queue tabs. */
export async function reviewFlagCounts() {
  const FLAGS = [
    "no-image",
    "no-description",
    "no-price",
    "uncategorised",
    "possible-service",
    "not-a-product",
    "low-confidence-category",
    "reclassified-as-service-or-removed-upstream",
  ] as const;

  const counts = await Promise.all(
    FLAGS.map((flag) =>
      db.product.count({
        where: { needsReview: true, reviewReason: { contains: flag } },
      }),
    ),
  );

  return FLAGS.map((flag, i) => ({ flag, count: counts[i] })).filter((f) => f.count > 0);
}
