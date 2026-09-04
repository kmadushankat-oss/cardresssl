"use server";

import { revalidateProducts } from "@/lib/cache";
import { z } from "zod";

import {
  ActionError,
  actionError,
  actionOk,
  defineAction,
  type ActionResult,
} from "@/lib/action";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import { deleteImage, storeImage } from "@/lib/storage";
import { slugify, uniqueSlug } from "@/lib/utils";
import { productSchema } from "@/lib/validation/product";

export type { ProductInput } from "@/lib/validation/product";

export const saveProduct = defineAction({
  permission: "product:update",
  input: productSchema,
  audit: { action: "UPDATE", entity: "Product" },
  handler: async ({ input, audit }) => {
    const { id, ...fields } = input;

    // A SKU is what staff quote on the phone; two products sharing one is a
    // real operational problem, so it is checked before writing.
    const clash = await db.product.findFirst({
      where: { sku: fields.sku, ...(id ? { id: { not: id } } : {}) },
      select: { id: true, name: true },
    });
    if (clash) {
      throw new ActionError(`SKU ${fields.sku} is already used by "${clash.name}"`, {
        sku: [`Already used by "${clash.name}"`],
      });
    }

    const data = {
      ...fields,
      // Reviewing by hand overrides whatever the importer guessed.
      classifiedBy: "MANUAL" as const,
      reviewReason: fields.needsReview ? undefined : null,
    };

    const product = id
      ? await db.product.update({ where: { id }, data })
      : await db.product.create({
          data: {
            ...data,
            slug: await uniqueSlug(fields.name, async (slug) =>
              Boolean(await db.product.findUnique({ where: { slug }, select: { id: true } })),
            ),
          },
        });

    audit({
      entityId: product.id,
      summary: `${id ? "Updated" : "Created"} product "${product.name}" (${product.sku})`,
    });

    revalidateProducts(product.id);
    return { id: product.id, name: product.name };
  },
});

export const deleteProduct = defineAction({
  permission: "product:delete",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "DELETE", entity: "Product" },
  handler: async ({ input, audit }) => {
    const product = await db.product.findUnique({
      where: { id: input.id },
      select: { name: true, images: { select: { url: true } } },
    });
    if (!product) throw new ActionError("That product no longer exists");

    await db.product.delete({ where: { id: input.id } });
    // Only after the row is gone, so a failed delete does not orphan the files.
    for (const image of product.images) await deleteImage(image.url);

    audit({ entityId: input.id, summary: `Deleted product "${product.name}"` });

    revalidateProducts();
    return { name: product.name };
  },
});

/** Clear the review flag without opening the full edit form. */
export const markProductReviewed = defineAction({
  permission: "product:update",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "REVIEW", entity: "Product" },
  handler: async ({ input, audit }) => {
    const product = await db.product.update({
      where: { id: input.id },
      data: { needsReview: false, reviewReason: null, classifiedBy: "MANUAL" },
      select: { name: true },
    });
    audit({
      entityId: input.id,
      summary: `Marked "${product.name}" as reviewed`,
    });

    revalidateProducts();
    return { name: product.name };
  },
});

/**
 * Image upload.
 *
 * Kept out of `defineAction` because it takes a FormData carrying a File,
 * which Zod cannot usefully describe — so the permission check is written out
 * explicitly here instead.
 */
export async function uploadProductImage(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const user = await getSessionUser();
  if (!user || !user.isActive || !can(user.role, "product:update")) {
    return actionError("You do not have permission to upload images.");
  }

  const productId = formData.get("productId");
  const file = formData.get("file");

  if (typeof productId !== "string" || !productId) {
    return actionError("Save the product before adding images.");
  }
  if (!(file instanceof File) || file.size === 0) {
    return actionError("Choose an image to upload.");
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, _count: { select: { images: true } } },
  });
  if (!product) return actionError("That product no longer exists.");

  try {
    const stored = await storeImage(file, {
      folder: `products/${slugify(product.name)}`,
      preset: "full",
    });

    await db.$transaction([
      db.productImage.create({
        data: {
          productId,
          url: stored.url,
          alt: product.name,
          sortOrder: product._count.images,
          // The first image uploaded becomes the one shown in listings.
          isPrimary: product._count.images === 0,
        },
      }),
      db.media.create({
        data: {
          filename: stored.filename,
          originalName: file.name,
          url: stored.url,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          width: stored.width,
          height: stored.height,
          alt: product.name,
          folder: "products",
          uploadedById: user.id,
        },
      }),
    ]);

    revalidateProducts(productId);

    return actionOk({ url: stored.url });
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "The image could not be uploaded.",
    );
  }
}

export const deleteProductImage = defineAction({
  permission: "product:update",
  input: z.object({ imageId: z.string().min(1) }),
  audit: { action: "DELETE", entity: "ProductImage" },
  handler: async ({ input, audit }) => {
    const image = await db.productImage.findUnique({
      where: { id: input.imageId },
      select: { id: true, url: true, productId: true, isPrimary: true },
    });
    if (!image) throw new ActionError("That image no longer exists");

    await db.productImage.delete({ where: { id: image.id } });

    // Never leave a product with images but no primary one.
    if (image.isPrimary) {
      const next = await db.productImage.findFirst({
        where: { productId: image.productId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (next) {
        await db.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    await deleteImage(image.url);

    audit({ entityId: image.productId, summary: "Deleted a product image" });

    revalidateProducts(image.productId);
    return { imageId: image.id };
  },
});

export const setPrimaryProductImage = defineAction({
  permission: "product:update",
  input: z.object({ imageId: z.string().min(1) }),
  audit: { action: "UPDATE", entity: "ProductImage" },
  handler: async ({ input, audit }) => {
    const image = await db.productImage.findUnique({
      where: { id: input.imageId },
      select: { id: true, productId: true },
    });
    if (!image) throw new ActionError("That image no longer exists");

    await db.$transaction([
      db.productImage.updateMany({
        where: { productId: image.productId },
        data: { isPrimary: false },
      }),
      db.productImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      }),
    ]);

    audit({ entityId: image.productId, summary: "Changed the main product image" });

    revalidateProducts(image.productId);
    return { imageId: image.id };
  },
});
