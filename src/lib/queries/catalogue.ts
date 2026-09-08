import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const CATALOGUE_PAGE_SIZE = 24;

export type CatalogueSort = "relevant" | "price-asc" | "price-desc" | "name" | "newest";

export type CatalogueParams = {
  q?: string;
  category?: string;
  brand?: string;
  condition?: string;
  /** Vehicle make, from the fitment selector. */
  make?: string;
  /** Vehicle model, only meaningful with a make. */
  model?: string;
  /** Registration year, matched against a fitment's from/to range. */
  year?: number;
  inStock?: boolean;
  sort?: CatalogueSort;
  page?: number;
};

/**
 * Only sellable products reach the storefront.
 *
 * Inactive rows are the 261 the import deactivated — no price, or an invoice
 * line like "Previous Balance" that was never a product. Publishing those was
 * exactly the failure mode worth designing out.
 */
const PUBLIC_BASE: Prisma.ProductWhereInput = {
  isActive: true,
  price: { gt: 0 },
};

const ORDER_BY: Record<CatalogueSort, Prisma.ProductOrderByWithRelationInput[]> = {
  // Featured first, then the ones with photos, since a card with an image
  // converts far better than one without.
  relevant: [{ isFeatured: "desc" }, { viewCount: "desc" }, { name: "asc" }],
  "price-asc": [{ price: "asc" }],
  "price-desc": [{ price: "desc" }],
  name: [{ name: "asc" }],
  newest: [{ createdAt: "desc" }],
};

export function buildCatalogueWhere(
  params: CatalogueParams,
): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [PUBLIC_BASE];

  if (params.q?.trim()) {
    const q = params.q.trim();
    /*
     * Match the part number as well as the name. A mechanic with the old part
     * in their hand searches by the number stamped on it, which is precisely
     * what the reference site cannot do.
     */
    clauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { partNumber: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (params.category) {
    // Match a parent or a child slug, so a top-level category shows its subtree.
    clauses.push({
      OR: [
        { category: { slug: params.category } },
        { category: { parent: { slug: params.category } } },
      ],
    });
  }

  if (params.brand) clauses.push({ brand: { slug: params.brand } });

  if (params.condition) {
    clauses.push({
      condition: params.condition as Prisma.ProductWhereInput["condition"],
    });
  }

  if (params.inStock) {
    // A product that does not track inventory is treated as available — the
    // counter staff know what is on the shelf.
    clauses.push({
      OR: [{ trackInventory: false }, { stockQty: { gt: 0 } }],
    });
  }

  /*
   * Vehicle fitment. The whole reason a parts site is usable: the reference
   * site stores this data per product but offers no way to filter by it, so
   * customers scroll 293 pages instead.
   *
   * A year matches when it falls inside the fitment's range, and an open-ended
   * range (no yearFrom or no yearTo) still counts.
   */
  if (params.make) {
    const fitment: Prisma.VehicleFitmentWhereInput = {
      make: { equals: params.make, mode: "insensitive" },
    };

    if (params.model) {
      fitment.model = { equals: params.model, mode: "insensitive" };
    }

    if (params.year) {
      fitment.AND = [
        { OR: [{ yearFrom: null }, { yearFrom: { lte: params.year } }] },
        { OR: [{ yearTo: null }, { yearTo: { gte: params.year } }] },
      ];
    }

    clauses.push({ fitments: { some: fitment } });
  }

  return { AND: clauses };
}

export async function listCatalogue(params: CatalogueParams) {
  const page = Math.max(1, params.page ?? 1);
  const where = buildCatalogueWhere(params);

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: ORDER_BY[params.sort ?? "relevant"],
      skip: (page - 1) * CATALOGUE_PAGE_SIZE,
      take: CATALOGUE_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        discountedPrice: true,
        condition: true,
        stockQty: true,
        trackInventory: true,
        shortDescription: true,
        brand: { select: { name: true } },
        category: { select: { name: true, slug: true } },
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
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
    pageSize: CATALOGUE_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / CATALOGUE_PAGE_SIZE)),
  };
}

export type CatalogueItem = Awaited<ReturnType<typeof listCatalogue>>["items"][number];

/**
 * Facet counts for the current filter set.
 *
 * Counted against the same filters minus the facet being counted, so choosing
 * a brand does not zero out every other brand's number.
 */
export async function catalogueFacets(params: CatalogueParams) {
  const [categories, brands, conditions] = await Promise.all([
    db.category.findMany({
      where: {
        isActive: true,
        parentId: null,
        OR: [
          { products: { some: PUBLIC_BASE } },
          { children: { some: { products: { some: PUBLIC_BASE } } } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        slug: true,
        _count: { select: { products: { where: PUBLIC_BASE } } },
        children: {
          where: { isActive: true, products: { some: PUBLIC_BASE } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            name: true,
            slug: true,
            _count: { select: { products: { where: PUBLIC_BASE } } },
          },
        },
      },
    }),
    db.brand.findMany({
      where: { isActive: true, products: { some: PUBLIC_BASE } },
      orderBy: { name: "asc" },
      select: {
        name: true,
        slug: true,
        _count: { select: { products: { where: PUBLIC_BASE } } },
      },
    }),
    db.product.groupBy({
      by: ["condition"],
      where: { ...PUBLIC_BASE, ...buildCatalogueWhere({ ...params, condition: undefined }) },
      _count: true,
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      name: c.name,
      slug: c.slug,
      // A parent's own count excludes its children's, so add them back.
      count:
        c._count.products + c.children.reduce((sum, ch) => sum + ch._count.products, 0),
      children: c.children.map((ch) => ({
        name: ch.name,
        slug: ch.slug,
        count: ch._count.products,
      })),
    })),
    brands: brands.map((b) => ({ name: b.name, slug: b.slug, count: b._count.products })),
    conditions: conditions.map((c) => ({ value: c.condition, count: c._count })),
  };
}

/** Distinct vehicle makes and models, for the fitment selector. */
export async function fitmentOptions(make?: string) {
  const makes = await db.vehicleFitment.findMany({
    distinct: ["make"],
    orderBy: { make: "asc" },
    select: { make: true },
  });

  const models = make
    ? await db.vehicleFitment.findMany({
        where: { make: { equals: make, mode: "insensitive" }, model: { not: null } },
        distinct: ["model"],
        orderBy: { model: "asc" },
        select: { model: true },
      })
    : [];

  return {
    makes: makes.map((m) => m.make),
    models: models.map((m) => m.model).filter((m): m is string => Boolean(m)),
  };
}

/** One product for its public page, or null when it should not be shown. */
export async function getPublicProduct(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, ...PUBLIC_BASE },
    include: {
      brand: { select: { name: true, slug: true } },
      category: {
        select: { name: true, slug: true, parent: { select: { name: true, slug: true } } },
      },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      fitments: { orderBy: [{ make: "asc" }, { model: "asc" }] },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return product;
}

/** Other parts in the same category, for the bottom of a product page. */
export async function relatedProducts(productId: string, categoryId: string | null) {
  if (!categoryId) return [];

  return db.product.findMany({
    where: { ...PUBLIC_BASE, categoryId, id: { not: productId } },
    orderBy: [{ isFeatured: "desc" }, { viewCount: "desc" }],
    take: 4,
    select: {
      name: true,
      slug: true,
      price: true,
      discountedPrice: true,
      condition: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { url: true, alt: true },
      },
    },
  });
}
