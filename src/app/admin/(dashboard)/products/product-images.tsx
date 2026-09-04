"use client";

import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { FormMessage } from "@/components/admin/form-shell";
import { cn } from "@/lib/utils";

import {
  deleteProductImage,
  setPrimaryProductImage,
  uploadProductImage,
} from "./actions";

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
};

/**
 * Product gallery manager.
 *
 * Separate from the main form because uploads happen immediately rather than
 * on save: 692 products need photos, and losing a batch of uploads because
 * someone navigated away before pressing Save would be its own problem.
 */
export function ProductImages({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatus(null);

    let uploaded = 0;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("file", file);

      const result = await uploadProductImage(formData);
      if (!result.ok) {
        setStatus({ kind: "error", text: `${file.name}: ${result.error}` });
        break;
      }
      uploaded++;
    }

    if (uploaded > 0) {
      setStatus({
        kind: "success",
        text: `${uploaded} image${uploaded === 1 ? "" : "s"} added.`,
      });
      startTransition(() => router.refresh());
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onDelete(imageId: string) {
    if (!window.confirm("Remove this image?")) return;
    setBusy(true);
    const result = await deleteProductImage({ imageId });
    if (!result.ok) setStatus({ kind: "error", text: result.error });
    else startTransition(() => router.refresh());
    setBusy(false);
  }

  async function onMakePrimary(imageId: string) {
    setBusy(true);
    const result = await setPrimaryProductImage({ imageId });
    if (!result.ok) setStatus({ kind: "error", text: result.error });
    else startTransition(() => router.refresh());
    setBusy(false);
  }

  return (
    <section className="rounded-card border border-border bg-surface-raised p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold">Photos</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        The first photo is used in listings. JPEG, PNG, WebP or AVIF, up to 10 MB
        each — they are resized and converted automatically.
      </p>

      <div className="mt-4 space-y-4">
        <FormMessage status={status} />

        {images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <li
                key={image.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-surface"
              >
                <Image
                  src={image.url}
                  alt={image.alt ?? ""}
                  width={300}
                  height={300}
                  className="aspect-square w-full object-cover"
                />

                {image.isPrimary && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                    <Star className="size-3" aria-hidden />
                    Main
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-ink-950/80 to-transparent p-1.5">
                  {!image.isPrimary && (
                    <button
                      type="button"
                      onClick={() => onMakePrimary(image.id)}
                      disabled={busy}
                      title="Use as the main photo"
                      className="grid size-8 place-items-center rounded-md bg-white/90 text-ink-900 hover:bg-white disabled:opacity-50"
                    >
                      <Star className="size-4" aria-hidden />
                      <span className="sr-only">Use as the main photo</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(image.id)}
                    disabled={busy}
                    title="Remove this photo"
                    className="grid size-8 place-items-center rounded-md bg-white/90 text-danger hover:bg-white disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Remove this photo</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2",
            "rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center",
            "hover:border-primary hover:bg-primary/5",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          ) : (
            <ImagePlus className="size-5 text-foreground-muted" aria-hidden />
          )}
          <span className="text-sm font-medium">
            {busy ? "Uploading…" : "Add photos"}
          </span>
          <span className="text-xs text-foreground-muted">
            You can select several at once
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
    </section>
  );
}
