import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/session";

import { CategoryManager, type CategoryNode } from "./category-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requireAnyPermission(["category:manage", "product:view"]);

  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      description: true,
      iconName: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
      isFeatured: true,
      seoTitle: true,
      seoDescription: true,
      _count: { select: { products: true } },
    },
  });

  const byId = new Map<string, CategoryNode>(
    rows.map((row) => [
      row.id,
      { ...row, productCount: row._count.products, children: [] },
    ]),
  );

  const tree: CategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId) byId.get(node.parentId)?.children.push(node);
    else tree.push(node);
  }

  const uncategorised = await db.product.count({ where: { categoryId: null } });

  return (
    <div>
      <PageHeader
        title="Categories"
        description={`${rows.length} categories across ${tree.length} main groups. Products roll up from a subcategory to its parent.`}
      />

      {uncategorised > 0 && (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          {uncategorised} product{uncategorised === 1 ? " is" : "s are"} still
          uncategorised. They are listed under{" "}
          <a
            href="/admin/products/review?flag=uncategorised"
            className="font-medium underline"
          >
            Needs review
          </a>
          .
        </p>
      )}

      <CategoryManager tree={tree} canManage={can(user.role, "category:manage")} />
    </div>
  );
}
