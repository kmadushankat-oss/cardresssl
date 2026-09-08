"use client";

import { ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { CheckboxField, FormMessage, FormRow } from "@/components/admin/form-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { deleteCategory, saveCategory } from "./actions";
import { CategoryImageField } from "./category-image-field";

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  iconName: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
  children: CategoryNode[];
};

type Draft = {
  id?: string;
  name: string;
  parentId: string;
  description: string;
  iconName: string;
  imageUrl: string;
  sortOrder: string;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
};

function toDraft(node?: CategoryNode, parentId = ""): Draft {
  return {
    id: node?.id,
    name: node?.name ?? "",
    parentId: node?.parentId ?? parentId,
    description: node?.description ?? "",
    iconName: node?.iconName ?? "",
    imageUrl: node?.imageUrl ?? "",
    sortOrder: String(node?.sortOrder ?? 0),
    isActive: node?.isActive ?? true,
    isFeatured: node?.isFeatured ?? false,
    seoTitle: node?.seoTitle ?? "",
    seoDescription: node?.seoDescription ?? "",
  };
}

export function CategoryManager({
  tree,
  canManage,
}: {
  tree: CategoryNode[];
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

  const parentOptions = tree.map((node) => ({ value: node.id, label: node.name }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setStatus(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const read = (k: string) => String(form.get(k) ?? "");

    const result = await saveCategory({
      id: draft.id,
      name: read("name"),
      parentId: read("parentId"),
      description: read("description"),
      iconName: read("iconName"),
      imageUrl: read("imageUrl"),
      sortOrder: read("sortOrder") || "0",
      isActive: form.get("isActive") === "true",
      isFeatured: form.get("isFeatured") === "true",
      seoTitle: read("seoTitle"),
      seoDescription: read("seoDescription"),
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

  async function onDelete(node: CategoryNode) {
    const warning = node.productCount
      ? `\n\n${node.productCount} product(s) will be left uncategorised. They are not deleted.`
      : "";
    if (!window.confirm(`Delete "${node.name}"?${warning}`)) return;

    setBusy(true);
    const result = await deleteCategory({ id: node.id });
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
          <Button type="button" onClick={() => setDraft(toDraft())}>
            <Plus className="size-4" aria-hidden />
            New category
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {tree.map((parent) => (
          <li
            key={parent.id}
            className="rounded-card border border-border bg-surface-raised"
          >
            <Row
              node={parent}
              canManage={canManage}
              onEdit={() => setDraft(toDraft(parent))}
              onDelete={() => onDelete(parent)}
              onAddChild={() => setDraft(toDraft(undefined, parent.id))}
            />

            {parent.children.length > 0 && (
              <ul className="border-t border-border-subtle">
                {parent.children.map((child) => (
                  <li key={child.id} className="border-b border-border-subtle last:border-0">
                    <Row
                      node={child}
                      nested
                      canManage={canManage}
                      onEdit={() => setDraft(toDraft(child))}
                      onDelete={() => onDelete(child)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setDraft(null)}
        aria-labelledby="category-dialog-title"
        className="w-[min(34rem,calc(100vw-2rem))] rounded-card border border-border bg-surface-raised p-0 text-foreground backdrop:bg-ink-950/60"
      >
        {draft && (
          <>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 id="category-dialog-title" className="font-display font-semibold">
                {draft.id ? "Edit category" : "New category"}
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

              <Field label="Name" required error={err("name")}>
                {(p) => <Input {...p} name="name" defaultValue={draft.name} required autoFocus />}
              </Field>

              <FormRow>
                <Field
                  label="Parent category"
                  error={err("parentId")}
                  hint="Leave as top level for a main group."
                >
                  {(p) => (
                    <Select {...p} name="parentId" defaultValue={draft.parentId}>
                      <option value="">Top level</option>
                      {parentOptions
                        .filter((o) => o.value !== draft.id)
                        .map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                    </Select>
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

              <CategoryImageField
                defaultValue={draft.imageUrl}
                categoryName={draft.name}
              />

              <CheckboxField
                name="isActive"
                label="Active"
                hint="Unticked categories are hidden from the website."
                defaultChecked={draft.isActive}
              />
              <CheckboxField
                name="isFeatured"
                label="Featured"
                hint="Highlighted on the home page."
                defaultChecked={draft.isFeatured}
              />

              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Search engine details
                </summary>
                <div className="mt-3 space-y-3">
                  <Field label="SEO title" error={err("seoTitle")}>
                    {(p) => <Input {...p} name="seoTitle" defaultValue={draft.seoTitle} />}
                  </Field>
                  <Field label="SEO description" error={err("seoDescription")}>
                    {(p) => (
                      <Textarea
                        {...p}
                        name="seoDescription"
                        defaultValue={draft.seoDescription}
                        rows={2}
                      />
                    )}
                  </Field>
                </div>
              </details>

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" loading={busy}>
                  {draft.id ? "Save changes" : "Create category"}
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

function Row({
  node,
  nested,
  canManage,
  onEdit,
  onDelete,
  onAddChild,
}: {
  node: CategoryNode;
  nested?: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 p-3", nested && "pl-8")}>
      {nested && (
        <ChevronRight className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn("truncate", nested ? "text-sm" : "font-medium")}>
            {node.name}
          </span>
          {!node.isActive && <Badge tone="neutral">Hidden</Badge>}
          {node.isFeatured && <Badge tone="brand">Featured</Badge>}
        </p>
        <p className="text-xs text-foreground-subtle">
          {node.productCount} product{node.productCount === 1 ? "" : "s"}
          {node.children.length > 0 && ` · ${node.children.length} subcategories`}
        </p>
      </div>

      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          {onAddChild && (
            <button
              type="button"
              onClick={onAddChild}
              title={`Add a subcategory under ${node.name}`}
              className="grid size-9 place-items-center rounded-lg text-foreground-muted hover:bg-surface hover:text-foreground"
            >
              <Plus className="size-4" aria-hidden />
              <span className="sr-only">Add a subcategory under {node.name}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="grid size-9 place-items-center rounded-lg text-foreground-muted hover:bg-surface hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden />
            <span className="sr-only">Edit {node.name}</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="grid size-9 place-items-center rounded-lg text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">Delete {node.name}</span>
          </button>
        </div>
      )}
    </div>
  );
}
