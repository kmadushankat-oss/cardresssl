"use server";

import { z } from "zod";

import { ActionError, defineAction } from "@/lib/action";
import { revalidateCategories } from "@/lib/cache";
import { db } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/utils";

const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Give the category a name"),
  parentId: z.string().transform(blankToNull),
  description: z.string().transform(blankToNull),
  iconName: z.string().transform(blankToNull),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.coerce.boolean(),
  isFeatured: z.coerce.boolean(),
  seoTitle: z.string().transform(blankToNull),
  seoDescription: z.string().transform(blankToNull),
});

export const saveCategory = defineAction({
  permission: "category:manage",
  input: categorySchema,
  audit: { action: "UPDATE", entity: "Category" },
  handler: async ({ input, audit }) => {
    const { id, ...fields } = input;

    if (id && fields.parentId === id) {
      throw new ActionError("A category cannot be its own parent.", {
        parentId: ["Choose a different parent"],
      });
    }

    /*
     * The tree is only two deep by design — a parent and its children. Letting
     * a category whose own children exist become someone else's child would
     * create a third level that no listing or breadcrumb renders.
     */
    if (id && fields.parentId) {
      const childCount = await db.category.count({ where: { parentId: id } });
      if (childCount > 0) {
        throw new ActionError(
          "This category has subcategories, so it cannot itself become a subcategory. Move its children first.",
          { parentId: ["Would nest too deeply"] },
        );
      }

      const parent = await db.category.findUnique({
        where: { id: fields.parentId },
        select: { parentId: true, name: true },
      });
      if (parent?.parentId) {
        throw new ActionError(
          `"${parent.name}" is already a subcategory. Pick a top-level category instead.`,
          { parentId: ["Would nest too deeply"] },
        );
      }
    }

    const category = id
      ? await db.category.update({ where: { id }, data: fields })
      : await db.category.create({
          data: {
            ...fields,
            slug: await uniqueSlug(fields.name, async (slug) =>
              Boolean(
                await db.category.findUnique({ where: { slug }, select: { id: true } }),
              ),
            ),
          },
        });

    audit({
      entityId: category.id,
      summary: `${id ? "Updated" : "Created"} category "${category.name}"`,
    });

    revalidateCategories();
    return { id: category.id, name: category.name };
  },
});

export const deleteCategory = defineAction({
  permission: "category:manage",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "DELETE", entity: "Category" },
  handler: async ({ input, audit }) => {
    const category = await db.category.findUnique({
      where: { id: input.id },
      select: {
        name: true,
        _count: { select: { products: true, children: true } },
      },
    });
    if (!category) throw new ActionError("That category no longer exists");

    if (category._count.children > 0) {
      throw new ActionError(
        `"${category.name}" has ${category._count.children} subcategor${
          category._count.children === 1 ? "y" : "ies"
        }. Delete or move those first.`,
      );
    }

    /*
     * Products survive: the schema sets their categoryId to null rather than
     * cascading. Deleting a category must never delete stock, so the message
     * says exactly how many products are about to be left uncategorised.
     */
    const orphaned = category._count.products;

    await db.category.delete({ where: { id: input.id } });

    audit({
      entityId: input.id,
      summary: `Deleted category "${category.name}"${
        orphaned ? ` — ${orphaned} product(s) left uncategorised` : ""
      }`,
    });

    revalidateCategories();
    return { name: category.name, orphaned };
  },
});

const brandSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Give the brand a name"),
  description: z.string().transform(blankToNull),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.coerce.boolean(),
});

export const saveBrand = defineAction({
  permission: "brand:manage",
  input: brandSchema,
  audit: { action: "UPDATE", entity: "Brand" },
  handler: async ({ input, audit }) => {
    const { id, ...fields } = input;

    const clash = await db.brand.findFirst({
      where: { name: fields.name, ...(id ? { id: { not: id } } : {}) },
      select: { name: true },
    });
    if (clash) {
      throw new ActionError(`A brand called "${clash.name}" already exists`, {
        name: ["Already used"],
      });
    }

    const brand = id
      ? await db.brand.update({ where: { id }, data: fields })
      : await db.brand.create({
          data: { ...fields, slug: slugify(fields.name) },
        });

    audit({
      entityId: brand.id,
      summary: `${id ? "Updated" : "Created"} brand "${brand.name}"`,
    });

    revalidateCategories();
    return { id: brand.id, name: brand.name };
  },
});

export const deleteBrand = defineAction({
  permission: "brand:manage",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "DELETE", entity: "Brand" },
  handler: async ({ input, audit }) => {
    const brand = await db.brand.findUnique({
      where: { id: input.id },
      select: { name: true, _count: { select: { products: true } } },
    });
    if (!brand) throw new ActionError("That brand no longer exists");

    await db.brand.delete({ where: { id: input.id } });

    audit({
      entityId: input.id,
      summary: `Deleted brand "${brand.name}"${
        brand._count.products ? ` — ${brand._count.products} product(s) left without a brand` : ""
      }`,
    });

    revalidateCategories();
    return { name: brand.name, orphaned: brand._count.products };
  },
});
