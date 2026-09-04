import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { categoryOptions } from "@/lib/queries/products";
import { requirePermission } from "@/lib/session";

import { ProductForm, type ProductFormValues } from "../product-form";
import { ProductImages } from "../product-images";

export const metadata: Metadata = { title: "Edit product" };

/** Decimals arrive as objects; forms need plain strings. */
function decimalToInput(value: unknown, { hideZero = false } = {}): string {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (hideZero && n === 0) return "";
  // Trim a trailing ".00" so the field reads "1200" rather than "1200.00".
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]">) {
  const user = await requirePermission("product:update");
  const { id } = await params;

  const [product, categories, brands] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      },
    }),
    categoryOptions(),
    db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const values: ProductFormValues = {
    id: product.id,
    name: product.name,
    sku: product.sku,
    partNumber: product.partNumber ?? "",
    barcode: product.barcode ?? "",
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    costPrice: decimalToInput(product.costPrice, { hideZero: true }),
    price: decimalToInput(product.price, { hideZero: true }),
    discountedPrice: decimalToInput(product.discountedPrice),
    taxRate: decimalToInput(product.taxRate, { hideZero: true }),
    trackInventory: product.trackInventory,
    stockQty: String(product.stockQty),
    lowStockThreshold: String(product.lowStockThreshold),
    condition: product.condition,
    warrantyMonths: product.warrantyMonths?.toString() ?? "",
    weightGrams: product.weightGrams?.toString() ?? "",
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    needsReview: product.needsReview,
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
  };

  return (
    <div>
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All products
      </Link>

      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{product.sku}</span>
            <Badge tone={product.isActive ? "success" : "neutral"}>
              {product.isActive ? "Active" : "Inactive"}
            </Badge>
            {product.needsReview && <Badge tone="warning">Needs review</Badge>}
            {product.wooId && (
              <Badge tone="info" title="Imported from the old WordPress site">
                Imported #{product.wooId}
              </Badge>
            )}
          </span>
        }
      />

      <div className="space-y-5">
        <ProductImages productId={product.id} images={product.images} />

        <ProductForm
          values={values}
          categories={categories}
          brands={brands.map((b) => ({ value: b.id, label: b.name }))}
          canDelete={can(user.role, "product:delete")}
          canViewCost={can(user.role, "product:viewCost")}
          reviewReason={product.reviewReason}
        />
      </div>
    </div>
  );
}
