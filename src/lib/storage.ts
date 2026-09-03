import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { put, del } from "@vercel/blob";
import sharp from "sharp";

import { isBlobConfigured, isProduction } from "@/lib/env";
import { slugify } from "@/lib/utils";

export type StoredImage = {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

/** Longest edge, in pixels, per named size. */
const PRESETS = {
  /** Product galleries and hero images. */
  full: 1600,
  /** Catalogue cards and listings. */
  card: 800,
  /** Admin tables and pickers. */
  thumb: 200,
} as const;

export type ImagePreset = keyof typeof PRESETS;

/**
 * Normalise an uploaded image and store it.
 *
 * Everything is converted to WebP and capped at the preset's longest edge:
 * phone photos straight off a camera are 4-8 MB, and serving those to a mobile
 * customer on Sri Lankan mobile data is the difference between a usable site
 * and an unusable one.
 *
 * Storage goes to Vercel Blob when configured, and to `public/uploads`
 * otherwise. The local path is a development convenience only — Vercel's
 * filesystem is ephemeral, so anything written there disappears on redeploy.
 */
export async function storeImage(
  file: File,
  opts: { folder?: string; preset?: ImagePreset } = {},
): Promise<StoredImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new Error(
      `Unsupported image type "${file.type}". Use JPEG, PNG, WebP, AVIF or GIF.`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`,
    );
  }

  const folder = slugify(opts.folder ?? "general") || "general";
  const maxEdge = PRESETS[opts.preset ?? "full"];

  const input = Buffer.from(await file.arrayBuffer());
  const { data, info } = await sharp(input)
    .rotate() // honour EXIF orientation before we discard the metadata
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";
  const filename = `${base}-${randomBytes(4).toString("hex")}.webp`;
  const key = `${folder}/${filename}`;

  const url = isBlobConfigured
    ? await putToBlob(key, data)
    : await putToLocalDisk(key, data);

  return {
    url,
    filename,
    mimeType: "image/webp",
    sizeBytes: data.byteLength,
    width: info.width ?? null,
    height: info.height ?? null,
  };
}

/**
 * Store bytes we fetched ourselves rather than received as an upload — used by
 * the WooCommerce importer, which downloads each product image.
 */
export async function storeImageBuffer(
  buffer: Buffer,
  opts: { filename: string; folder?: string; preset?: ImagePreset },
): Promise<StoredImage> {
  const folder = slugify(opts.folder ?? "general") || "general";
  const maxEdge = PRESETS[opts.preset ?? "full"];

  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const base = slugify(opts.filename.replace(/\.[^.]+$/, "")) || "image";
  const filename = `${base}-${randomBytes(4).toString("hex")}.webp`;
  const key = `${folder}/${filename}`;

  const url = isBlobConfigured
    ? await putToBlob(key, data)
    : await putToLocalDisk(key, data);

  return {
    url,
    filename,
    mimeType: "image/webp",
    sizeBytes: data.byteLength,
    width: info.width ?? null,
    height: info.height ?? null,
  };
}

/** Remove a stored image. Local-disk files are left in place. */
export async function deleteImage(url: string): Promise<void> {
  if (!isBlobConfigured) return;
  try {
    await del(url);
  } catch (error) {
    // A missing blob is not worth failing a delete over — the database row is
    // the source of truth for what the site displays.
    console.warn("[storage] could not delete blob", url, error);
  }
}

async function putToBlob(key: string, data: Buffer): Promise<string> {
  const blob = await put(key, data, {
    access: "public",
    contentType: "image/webp",
    // Our filenames already carry random suffixes, so Vercel adding its own
    // would only make the URLs uglier.
    addRandomSuffix: false,
  });
  return blob.url;
}

async function putToLocalDisk(key: string, data: Buffer): Promise<string> {
  if (isProduction) {
    // Vercel's filesystem is ephemeral, so writing here would silently lose
    // the file on the next deploy. Fail loudly instead.
    throw new Error(
      "Image uploads require BLOB_READ_WRITE_TOKEN in production — the local disk is not persistent.",
    );
  }

  const target = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return `/uploads/${key}`;
}
