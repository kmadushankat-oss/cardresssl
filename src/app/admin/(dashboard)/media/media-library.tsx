"use client";

import { Check, Copy, ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/admin/form-shell";
import { cn } from "@/lib/utils";

import { deleteMedia, updateMediaAlt, uploadMedia } from "./actions";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  folder: string;
  uploadedBy: string | null;
  createdAt: string;
};

const FOLDER_CHOICES = [
  "general",
  "products",
  "services",
  "banners",
  "workshop",
  "team",
];

export function MediaLibrary({
  items,
  folders,
  activeFolder,
  canUpload,
  canDelete,
}: {
  items: MediaItem[];
  folders: { name: string; count: number }[];
  activeFolder: string | null;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [uploadFolder, setUploadFolder] = useState(activeFolder ?? "general");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setStatus(null);

    let done = 0;
    for (const file of Array.from(files)) {
      const data = new FormData();
      data.set("file", file);
      data.set("folder", uploadFolder);
      const result = await uploadMedia(data);
      if (!result.ok) {
        setStatus({ kind: "error", text: `${file.name}: ${result.error}` });
        break;
      }
      done++;
    }

    setBusy(false);
    if (done > 0) {
      setStatus({ kind: "success", text: `${done} file${done === 1 ? "" : "s"} uploaded.` });
      startTransition(() => router.refresh());
    }
  }

  async function onDelete(item: MediaItem) {
    if (
      !window.confirm(
        `Delete ${item.originalName}? If any product uses this photo, it will be removed from them too.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await deleteMedia({ id: item.id });
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    if (result.data.detachedFrom > 0) {
      setStatus({
        kind: "success",
        text: `Deleted, and removed from ${result.data.detachedFrom} product photo slot(s).`,
      });
    }
    setSelected(null);
    startTransition(() => router.refresh());
  }

  async function onSaveAlt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const result = await updateMediaAlt({
      id: selected.id,
      alt: String(form.get("alt") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    setSelected(null);
    startTransition(() => router.refresh());
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setStatus({ kind: "error", text: "Could not copy — select the URL and copy it manually." });
    }
  }

  return (
    <div className={cn(busy && "opacity-60")}>
      <div className="mb-4 space-y-3">
        <FormMessage status={status} />

        {/* Folder filter */}
        <nav aria-label="Filter by folder">
          <ul className="flex flex-wrap gap-2">
            <li>
              <FolderChip href="/admin/media" active={!activeFolder}>
                All
              </FolderChip>
            </li>
            {folders.map((f) => (
              <li key={f.name}>
                <FolderChip
                  href={`/admin/media?folder=${encodeURIComponent(f.name)}`}
                  active={activeFolder === f.name}
                >
                  {f.name} <span className="opacity-70">{f.count}</span>
                </FolderChip>
              </li>
            ))}
          </ul>
        </nav>

        {canUpload && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-foreground-muted">Upload into</span>
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="h-11 rounded-lg border border-border bg-surface-raised px-3 pr-8 text-sm"
              >
                {FOLDER_CHOICES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label
              className={cn(
                "inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4",
                "text-sm font-medium text-primary-foreground hover:bg-primary-hover",
                busy && "pointer-events-none",
              )}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
              {busy ? "Uploading…" : "Upload files"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                multiple
                className="sr-only"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface">
            <ImagePlus className="size-5 text-foreground-muted" aria-hidden />
          </div>
          <h2 className="font-display font-semibold">No files yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-foreground-muted">
            The old site had only two images in the whole catalogue, and both were
            theme placeholders — so nothing came across in the import. Upload your
            real photos here.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className="group block w-full overflow-hidden rounded-lg border border-border bg-surface text-left hover:border-primary"
              >
                <Image
                  src={item.url}
                  alt={item.alt ?? ""}
                  width={300}
                  height={300}
                  className="aspect-square w-full object-cover"
                />
                <span className="block truncate px-2 py-1.5 text-xs text-foreground-muted">
                  {item.originalName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detail panel */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.originalName}
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="w-[min(40rem,100%)] overflow-hidden rounded-card border border-border bg-surface-raised">
            <Image
              src={selected.url}
              alt={selected.alt ?? ""}
              width={800}
              height={600}
              className="max-h-[45vh] w-full bg-surface object-contain"
            />

            <div className="space-y-3 p-5">
              <div>
                <p className="truncate font-medium">{selected.originalName}</p>
                <p className="text-xs text-foreground-subtle">
                  {selected.width && selected.height
                    ? `${selected.width}×${selected.height} · `
                    : ""}
                  {(selected.sizeBytes / 1024).toFixed(0)} KB · {selected.folder}
                  {selected.uploadedBy ? ` · ${selected.uploadedBy}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={selected.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => copyUrl(selected.url)}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface"
                >
                  {copied === selected.url ? (
                    <Check className="size-4 text-success" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                  {copied === selected.url ? "Copied" : "Copy"}
                </button>
              </div>

              {canUpload && (
                <form onSubmit={onSaveAlt} className="space-y-2">
                  <label htmlFor="media-alt" className="block text-sm font-medium">
                    Alt text
                  </label>
                  <p className="text-xs text-foreground-muted">
                    Describes the image for screen readers and search engines.
                  </p>
                  <div className="flex gap-2">
                    <input
                      id="media-alt"
                      name="alt"
                      defaultValue={selected.alt ?? ""}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-2 text-sm focus:border-primary"
                      placeholder="e.g. Front brake pads for a Toyota Aqua"
                    />
                    <button
                      type="submit"
                      className="h-10 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              <div className="flex items-center gap-2 border-t border-border-subtle pt-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="h-10 rounded-lg px-3 text-sm text-foreground-muted hover:bg-surface hover:text-foreground"
                >
                  Close
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(selected)}
                    className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3 text-sm",
        active
          ? "border-primary bg-primary/12 font-medium text-primary-text"
          : "border-border text-foreground-muted hover:bg-surface hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
