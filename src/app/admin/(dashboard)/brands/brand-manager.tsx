"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { CheckboxField, FormMessage, FormRow } from "@/components/admin/form-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { deleteBrand, saveBrand } from "../categories/actions";

export type BrandRow = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

export function BrandManager({
  brands,
  canManage,
}: {
  brands: BrandRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (draft && !dialog.open) dialog.showModal();
    if (!draft && dialog.open) dialog.close();
  }, [draft]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setStatus(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const result = await saveBrand({
      id: draft.id,
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      sortOrder: String(form.get("sortOrder") ?? "0") || "0",
      isActive: form.get("isActive") === "true",
    });

    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    setDraft(null);
    startTransition(() => router.refresh());
  }

  async function onDelete(brand: BrandRow) {
    const warning = brand.productCount
      ? `\n\n${brand.productCount} product(s) will be left without a brand. They are not deleted.`
      : "";
    if (!window.confirm(`Delete "${brand.name}"?${warning}`)) return;

    setBusy(true);
    const result = await deleteBrand({ id: brand.id });
    setBusy(false);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  const err = (name: string) => fieldErrors[name]?.[0];

  return (
    <div className={cn(busy && "pointer-events-none opacity-60")}>
      {canManage && (
        <div className="mb-4">
          <Button
            type="button"
            onClick={() =>
              setDraft({ name: "", description: "", sortOrder: "0", isActive: true })
            }
          >
            <Plus className="size-4" aria-hidden />
            New brand
          </Button>
        </div>
      )}

      {brands.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {brands.map((brand) => (
            <li
              key={brand.id}
              className="flex items-center gap-3 rounded-card border border-border bg-surface-raised p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{brand.name}</span>
                  {!brand.isActive && <Badge tone="neutral">Hidden</Badge>}
                </p>
                <p className="text-xs text-foreground-subtle">
                  {brand.productCount} product{brand.productCount === 1 ? "" : "s"}
                </p>
              </div>

              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: brand.id,
                        name: brand.name,
                        description: brand.description ?? "",
                        sortOrder: String(brand.sortOrder),
                        isActive: brand.isActive,
                      })
                    }
                    title="Edit"
                    className="grid size-9 place-items-center rounded-lg text-foreground-muted hover:bg-surface hover:text-foreground"
                  >
                    <Pencil className="size-4" aria-hidden />
                    <span className="sr-only">Edit {brand.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(brand)}
                    title="Delete"
                    className="grid size-9 place-items-center rounded-lg text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">Delete {brand.name}</span>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setDraft(null)}
        aria-labelledby="brand-dialog-title"
        className="w-[min(30rem,calc(100vw-2rem))] rounded-card border border-border bg-surface-raised p-0 text-foreground backdrop:bg-ink-950/60"
      >
        {draft && (
          <>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 id="brand-dialog-title" className="font-display font-semibold">
                {draft.id ? "Edit brand" : "New brand"}
              </h2>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-lg text-foreground-muted hover:bg-surface"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
              <FormMessage status={status} />

              <FormRow>
                <Field label="Name" required error={err("name")}>
                  {(p) => (
                    <Input {...p} name="name" defaultValue={draft.name} required autoFocus />
                  )}
                </Field>
                <Field label="Display order" error={err("sortOrder")}>
                  {(p) => (
                    <Input
                      {...p}
                      name="sortOrder"
                      defaultValue={draft.sortOrder}
                      inputMode="numeric"
                    />
                  )}
                </Field>
              </FormRow>

              <Field label="Description" error={err("description")}>
                {(p) => (
                  <Textarea {...p} name="description" defaultValue={draft.description} rows={2} />
                )}
              </Field>

              <CheckboxField
                name="isActive"
                label="Active"
                hint="Unticked brands are hidden from the catalogue filters."
                defaultChecked={draft.isActive}
              />

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={busy}>
                  {draft.id ? "Save changes" : "Create brand"}
                </Button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="h-11 rounded-lg px-4 text-sm font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </dialog>
    </div>
  );
}
