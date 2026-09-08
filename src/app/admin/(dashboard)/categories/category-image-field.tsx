"use client";

import { ImageOff, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { uploadMedia } from "../media/actions";

/**
 * The one photo shown for a category on the home page.
 *
 * Uploads immediately and keeps the resulting URL in a hidden input, so the
 * category form submits a plain string and needs no knowledge of file handling.
 * The file also lands in the Media library, so the same photo can be reused
 * elsewhere rather than uploaded twice.
 */
export function CategoryImageField({
  defaultValue,
  categoryName,
}: {
  defaultValue: string;
  categoryName: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);

    const data = new FormData();
    data.set("file", file);
    data.set("folder", "categories");

    const result = await uploadMedia(data);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUrl(result.data.url);
  }

  return (
    <div>
      <p className="text-sm font-medium">Category photo</p>
      <p className="mt-0.5 text-sm text-foreground-muted">
        One landscape image, shown on the home page. A wide crop works best.
      </p>

      {/* What the form actually submits. */}
      <input type="hidden" name="imageUrl" value={url} />

      <div className="mt-2 flex items-start gap-3">
        <div className="relative grid aspect-[4/3] w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface">
          {url ? (
            <Image
              src={url}
              alt={`${categoryName || "Category"} photo`}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <ImageOff className="size-5 text-foreground-subtle" aria-hidden />
          )}
        </div>

        <div className="space-y-2">
          <label
            className={
              busy
                ? "pointer-events-none inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm opacity-60"
                : "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-surface"
            }
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-4" aria-hidden />
            )}
            {busy ? "Uploading…" : url ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>

          {url && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="ml-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-foreground-muted hover:bg-surface hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
              Remove
            </button>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
