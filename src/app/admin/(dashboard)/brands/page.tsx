import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/session";

import { BrandManager } from "./brand-manager";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  const user = await requireAnyPermission(["brand:manage", "product:view"]);

  const brands = await db.brand.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  const withoutBrand = await db.product.count({ where: { brandId: null } });

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manufacturers and part brands. Customers can filter the parts catalogue by these."
      />

      {brands.length === 0 && withoutBrand > 0 && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-foreground-muted">
          No brands yet. The old site recorded none, so all {withoutBrand} products
          are unbranded. Adding the ones you stock — Denso, NGK, Aisin, Sachs,
          Febi, VIC — lets customers filter by them.
        </p>
      )}

      <BrandManager
        brands={brands.map((b) => ({ ...b, productCount: b._count.products }))}
        canManage={can(user.role, "brand:manage")}
      />
    </div>
  );
}
