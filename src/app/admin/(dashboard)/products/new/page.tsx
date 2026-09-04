import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { categoryOptions } from "@/lib/queries/products";
import { requirePermission } from "@/lib/session";

import { ProductForm, type ProductFormValues } from "../product-form";

export const metadata: Metadata = { title: "New product" };

const BLANK: ProductFormValues = {
  name: "",
  sku: "",
  partNumber: "",
  barcode: "",
  categoryId: "",
  brandId: "",
  shortDescription: "",
  description: "",
  costPrice: "",
  price: "",
  discountedPrice: "",
  taxRate: "",
  trackInventory: false,
  stockQty: "0",
  lowStockThreshold: "5",
  condition: "NEW",
  warrantyMonths: "",
  weightGrams: "",
  isActive: true,
  isFeatured: false,
  needsReview: false,
  seoTitle: "",
  seoDescription: "",
};

export default async function NewProductPage() {
  const user = await requirePermission("product:create");

  const [categories, brands] = await Promise.all([
    categoryOptions(),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

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
        title="New product"
        description="Photos can be added once the product is saved."
      />

      <ProductForm
        values={BLANK}
        categories={categories}
        brands={brands.map((b) => ({ value: b.id, label: b.name }))}
        canDelete={false}
        canViewCost={can(user.role, "product:viewCost")}
      />
    </div>
  );
}
