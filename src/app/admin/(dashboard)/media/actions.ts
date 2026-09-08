"use server";

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
import { revalidateProducts } from "@/lib/cache";

/** Free-standing uploads for banners, service photos and page content. */
export async function uploadMedia(
  formData: FormData,
): Promise<ActionResult<{ url: string; id: string }>> {
  const user = await getSessionUser();
  if (!user || !user.isActive || !can(user.role, "media:upload")) {
    return actionError("You do not have permission to upload files.");
  }

  const file = formData.get("file");
  const folderRaw = formData.get("folder");
  const folder =
    typeof folderRaw === "string" && /^[a-z0-9-]{1,40}$/.test(folderRaw)
      ? folderRaw
      : "general";

  if (!(file instanceof File) || file.size === 0) {
    return actionError("Choose a file to upload.");
  }

  try {
    const stored = await storeImage(file, { folder: `media/${folder}`, preset: "full" });

    const media = await db.media.create({
      data: {
        filename: stored.filename,
        originalName: file.name,
        url: stored.url,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        width: stored.width,
        height: stored.height,
        folder,
        uploadedById: user.id,
      },
      select: { id: true },
    });

    return actionOk({ url: stored.url, id: media.id });
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "That file could not be uploaded.",
    );
  }
}

export const updateMediaAlt = defineAction({
  permission: "media:upload",
  input: z.object({
    id: z.string().min(1),
    alt: z.string().trim().max(300).transform((v) => (v === "" ? null : v)),
  }),
  audit: { action: "UPDATE", entity: "Media" },
  handler: async ({ input, audit }) => {
    const media = await db.media.update({
      where: { id: input.id },
      data: { alt: input.alt },
      select: { filename: true },
    });
    audit({ entityId: input.id, summary: `Updated alt text for ${media.filename}` });
    return { filename: media.filename };
  },
});

export const deleteMedia = defineAction({
  permission: "media:delete",
  input: z.object({ id: z.string().min(1) }),
  audit: { action: "DELETE", entity: "Media" },
  handler: async ({ input, audit }) => {
    const media = await db.media.findUnique({
      where: { id: input.id },
      select: { url: true, filename: true },
    });
    if (!media) throw new ActionError("That file no longer exists");

    /*
     * A file can be a product's photo as well as a library entry. Deleting the
     * blob while a ProductImage still points at it leaves a broken image on the
     * storefront, so the product rows go first.
     */
    const usedBy = await db.productImage.findMany({
      where: { url: media.url },
      select: { id: true, productId: true, isPrimary: true },
    });

    await db.productImage.deleteMany({ where: { url: media.url } });

    // Keep every affected product's primary image consistent.
    for (const image of usedBy.filter((i) => i.isPrimary)) {
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

    await db.media.delete({ where: { id: input.id } });
    await deleteImage(media.url);

    if (usedBy.length > 0) revalidateProducts();

    audit({
      entityId: input.id,
      summary: `Deleted ${media.filename}${
        usedBy.length ? ` — removed from ${usedBy.length} product photo slot(s)` : ""
      }`,
    });

    return { filename: media.filename, detachedFrom: usedBy.length };
  },
});
