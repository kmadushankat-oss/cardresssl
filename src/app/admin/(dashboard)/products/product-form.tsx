"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  CheckboxField,
  FormActions,
  FormMessage,
  FormRow,
  FormSection,
} from "@/components/admin/form-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

import { deleteProduct, saveProduct, type ProductInput } from "./actions";

export type ProductFormValues = {
  id?: string;
  name: string;
  sku: string;
  partNumber: string;
  barcode: string;
  categoryId: string;
  brandId: string;
  shortDescription: string;
  description: string;
  costPrice: string;
  price: string;
  discountedPrice: string;
  taxRate: string;
  trackInventory: boolean;
  stockQty: string;
  lowStockThreshold: string;
  condition: string;
  warrantyMonths: string;
  weightGrams: string;
  isActive: boolean;
  isFeatured: boolean;
  needsReview: boolean;
  seoTitle: string;
  seoDescription: string;
};

type Option = { value: string; label: string };

const CONDITIONS: Option[] = [
  { value: "NEW", label: "New" },
  { value: "USED", label: "Used" },
  { value: "REFURBISHED", label: "Reconditioned" },
  { value: "OEM", label: "Genuine / OEM" },
  { value: "AFTERMARKET", label: "Aftermarket" },
];

export function ProductForm({
  values,
  categories,
  brands,
  canDelete,
  canViewCost,
  reviewReason,
}: {
  values: ProductFormValues;
  categories: Option[];
  brands: Option[];
  canDelete: boolean;
  canViewCost: boolean;
  reviewReason?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isNew = !values.id;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "");
    const checked = (key: string) => form.get(key) === "true";

    const result = await saveProduct({
      id: values.id,
      name: read("name"),
      sku: read("sku"),
      partNumber: read("partNumber"),
      barcode: read("barcode"),
      categoryId: read("categoryId"),
      brandId: read("brandId"),
      shortDescription: read("shortDescription"),
      description: read("description"),
      costPrice: read("costPrice"),
      price: read("price"),
      discountedPrice: read("discountedPrice"),
      taxRate: read("taxRate"),
      trackInventory: checked("trackInventory"),
      stockQty: read("stockQty"),
      lowStockThreshold: read("lowStockThreshold"),
      condition: read("condition") as ProductInput["condition"],
      warrantyMonths: read("warrantyMonths"),
      weightGrams: read("weightGrams"),
      isActive: checked("isActive"),
      isFeatured: checked("isFeatured"),
      needsReview: checked("needsReview"),
      seoTitle: read("seoTitle"),
      seoDescription: read("seoDescription"),
    });

    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setFieldErrors(result.fieldErrors ?? {});
      // Bring the first problem into view rather than leaving the user to hunt.
      const firstField = Object.keys(result.fieldErrors ?? {})[0];
      if (firstField) {
        document
          .querySelector<HTMLElement>(`[name="${firstField}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (isNew) {
      startTransition(() => router.push(`/admin/products/${result.data.id}`));
      return;
    }

    setStatus({ kind: "success", text: "Saved." });
    startTransition(() => router.refresh());
  }

  async function onDelete() {
    if (!values.id) return;
    const confirmed = window.confirm(
      `Delete "${values.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    const result = await deleteProduct({ id: values.id });
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setDeleting(false);
      return;
    }
    startTransition(() => router.push("/admin/products"));
  }

  const err = (name: string) => fieldErrors[name]?.[0];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormMessage status={status} />

      {reviewReason && values.needsReview && (
        <div
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
        >
          <strong className="font-medium">Flagged by the import:</strong>{" "}
          {reviewReason.split(", ").join(" · ")}. Fix what you can, then untick
          &ldquo;Needs review&rdquo; below.
        </div>
      )}

      <FormSection title="Identity" description="What the part is and how staff find it.">
        <Field label="Product name" required error={err("name")}>
          {(p) => (
            <Input {...p} name="name" defaultValue={values.name} required autoFocus={isNew} />
          )}
        </Field>

        <FormRow>
          <Field
            label="SKU"
            required
            error={err("sku")}
            hint="Your own code. Must be unique."
          >
            {(p) => (
              <Input {...p} name="sku" defaultValue={values.sku} required className="font-mono" />
            )}
          </Field>
          <Field
            label="Manufacturer part number"
            error={err("partNumber")}
            hint="The number printed on the box, if you have it."
          >
            {(p) => <Input {...p} name="partNumber" defaultValue={values.partNumber} />}
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Category" error={err("categoryId")}>
            {(p) => (
              <Select {...p} name="categoryId" defaultValue={values.categoryId}>
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Brand" error={err("brandId")}>
            {(p) => (
              <Select {...p} name="brandId" defaultValue={values.brandId}>
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Condition" error={err("condition")}>
            {(p) => (
              <Select {...p} name="condition" defaultValue={values.condition}>
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Barcode" error={err("barcode")}>
            {(p) => <Input {...p} name="barcode" defaultValue={values.barcode} />}
          </Field>
        </FormRow>
      </FormSection>

      <FormSection
        title="Pricing"
        description="Amounts in rupees. Leave the discounted price empty when there is no promotion."
      >
        <FormRow>
          <Field
            label="Selling price"
            error={err("price")}
            hint="Shown on the website."
          >
            {(p) => (
              <Input
                {...p}
                name="price"
                defaultValue={values.price}
                inputMode="decimal"
                className="tabular-nums"
              />
            )}
          </Field>
          <Field
            label="Discounted price"
            error={err("discountedPrice")}
            hint="Must be below the selling price."
          >
            {(p) => (
              <Input
                {...p}
                name="discountedPrice"
                defaultValue={values.discountedPrice}
                inputMode="decimal"
                className="tabular-nums"
              />
            )}
          </Field>
        </FormRow>

        <FormRow>
          {canViewCost ? (
            <Field
              label="Cost price"
              error={err("costPrice")}
              hint="What you paid. Never shown to customers."
            >
              {(p) => (
                <Input
                  {...p}
                  name="costPrice"
                  defaultValue={values.costPrice}
                  inputMode="decimal"
                  className="tabular-nums"
                />
              )}
            </Field>
          ) : (
            // Preserve the stored cost rather than blanking it on save.
            <input type="hidden" name="costPrice" value={values.costPrice} />
          )}
          <Field label="Tax rate (%)" error={err("taxRate")}>
            {(p) => (
              <Input
                {...p}
                name="taxRate"
                defaultValue={values.taxRate}
                inputMode="decimal"
                className="tabular-nums"
              />
            )}
          </Field>
        </FormRow>
      </FormSection>

      <FormSection
        title="Stock"
        description="Turn tracking on once you have counted real quantities. The import left it off, because the old site held no stock figures."
      >
        <CheckboxField
          name="trackInventory"
          label="Track stock for this product"
          defaultChecked={values.trackInventory}
        />
        <FormRow>
          <Field label="Quantity in stock" error={err("stockQty")}>
            {(p) => (
              <Input
                {...p}
                name="stockQty"
                defaultValue={values.stockQty}
                inputMode="numeric"
                className="tabular-nums"
              />
            )}
          </Field>
          <Field
            label="Low stock warning at"
            error={err("lowStockThreshold")}
            hint="Appears on the dashboard at or below this."
          >
            {(p) => (
              <Input
                {...p}
                name="lowStockThreshold"
                defaultValue={values.lowStockThreshold}
                inputMode="numeric"
                className="tabular-nums"
              />
            )}
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Description" description="What customers read.">
        <Field
          label="Short description"
          error={err("shortDescription")}
          hint="One or two lines, shown in listings."
        >
          {(p) => (
            <Textarea
              {...p}
              name="shortDescription"
              defaultValue={values.shortDescription}
              rows={2}
            />
          )}
        </Field>
        <Field label="Full description" error={err("description")}>
          {(p) => (
            <Textarea
              {...p}
              name="description"
              defaultValue={values.description}
              rows={6}
            />
          )}
        </Field>
        <FormRow>
          <Field label="Warranty (months)" error={err("warrantyMonths")}>
            {(p) => (
              <Input
                {...p}
                name="warrantyMonths"
                defaultValue={values.warrantyMonths}
                inputMode="numeric"
              />
            )}
          </Field>
          <Field label="Weight (grams)" error={err("weightGrams")}>
            {(p) => (
              <Input
                {...p}
                name="weightGrams"
                defaultValue={values.weightGrams}
                inputMode="numeric"
              />
            )}
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Visibility">
        <CheckboxField
          name="isActive"
          label="Active"
          hint="Unticked products are hidden from the website."
          defaultChecked={values.isActive}
        />
        <CheckboxField
          name="isFeatured"
          label="Featured"
          hint="Highlighted on the home page."
          defaultChecked={values.isFeatured}
        />
        <CheckboxField
          name="needsReview"
          label="Needs review"
          hint="Untick once you are happy with this product's details."
          defaultChecked={values.needsReview}
        />
      </FormSection>

      <FormSection
        title="Search engines"
        description="Optional. Leave empty to use the product name and description."
      >
        <Field label="SEO title" error={err("seoTitle")}>
          {(p) => <Input {...p} name="seoTitle" defaultValue={values.seoTitle} />}
        </Field>
        <Field label="SEO description" error={err("seoDescription")}>
          {(p) => (
            <Textarea
              {...p}
              name="seoDescription"
              defaultValue={values.seoDescription}
              rows={2}
            />
          )}
        </Field>
      </FormSection>

      <FormActions>
        <Button type="submit" loading={pending || deleting}>
          {isNew ? "Create product" : "Save changes"}
        </Button>
        <Link
          href="/admin/products"
          className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
        >
          Cancel
        </Link>

        {canDelete && !isNew && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            loading={deleting}
            className="ml-auto text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        )}
      </FormActions>
    </form>
  );
}
