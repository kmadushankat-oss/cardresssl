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
import {
  VEHICLE_CLASS_LABELS,
  VEHICLE_CLASSES,
  type ServiceInput,
} from "@/lib/validation/service";

import { deleteService, saveService } from "./actions";

export type ServiceFormValues = {
  id?: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  priceFrom: boolean;
  durationMinutes: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
  /** vehicleClass -> { price, durationMinutes } */
  prices: Record<string, { price: string; durationMinutes: string }>;
};

type Option = { value: string; label: string };

export function ServiceForm({
  values,
  categories,
  canDelete,
}: {
  values: ServiceFormValues;
  categories: Option[];
  canDelete: boolean;
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

    const payload: ServiceInput = {
      id: values.id,
      name: read("name"),
      categoryId: read("categoryId"),
      shortDescription: read("shortDescription"),
      description: read("description"),
      basePrice: read("basePrice"),
      priceFrom: checked("priceFrom"),
      durationMinutes: read("durationMinutes"),
      isActive: checked("isActive"),
      isFeatured: checked("isFeatured"),
      sortOrder: read("sortOrder") || "0",
      seoTitle: read("seoTitle"),
      seoDescription: read("seoDescription"),
      prices: VEHICLE_CLASSES.map((vc) => ({
        vehicleClass: vc,
        price: read(`price-${vc}`),
        durationMinutes: read(`duration-${vc}`),
      })),
    };

    const result = await saveService(payload);

    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    if (isNew) {
      startTransition(() => router.push(`/admin/services/${result.data.id}`));
      return;
    }
    setStatus({ kind: "success", text: "Saved." });
    startTransition(() => router.refresh());
  }

  async function onDelete() {
    if (!values.id) return;
    if (!window.confirm(`Delete "${values.name}"? This cannot be undone.`)) return;

    setDeleting(true);
    const result = await deleteService({ id: values.id });
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setDeleting(false);
      return;
    }
    startTransition(() => router.push("/admin/services"));
  }

  const err = (name: string) => fieldErrors[name]?.[0];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormMessage status={status} />

      <FormSection title="Service">
        <Field label="Name" required error={err("name")}>
          {(p) => (
            <Input {...p} name="name" defaultValue={values.name} required autoFocus={isNew} />
          )}
        </Field>

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
          <Field
            label="Display order"
            error={err("sortOrder")}
            hint="Lower numbers appear first."
          >
            {(p) => (
              <Input
                {...p}
                name="sortOrder"
                defaultValue={values.sortOrder}
                inputMode="numeric"
              />
            )}
          </Field>
        </FormRow>

        <Field
          label="Short description"
          error={err("shortDescription")}
          hint="One or two lines, shown on the services list."
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
            <Textarea {...p} name="description" defaultValue={values.description} rows={5} />
          )}
        </Field>
      </FormSection>

      <FormSection
        title="Price by vehicle size"
        description="Leave a row blank if you don't offer this service for that vehicle. Blank means not offered — it is not stored as free."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-border">
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Vehicle
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Price (Rs.)
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Time (mins)
                </th>
              </tr>
            </thead>
            <tbody>
              {VEHICLE_CLASSES.map((vc) => {
                const row = values.prices[vc] ?? { price: "", durationMinutes: "" };
                return (
                  <tr key={vc} className="border-b border-border-subtle last:border-0">
                    <th
                      scope="row"
                      className="py-2 pr-3 text-left font-normal whitespace-nowrap"
                    >
                      {VEHICLE_CLASS_LABELS[vc]}
                    </th>
                    <td className="py-2 pr-3">
                      <input
                        name={`price-${vc}`}
                        defaultValue={row.price}
                        inputMode="decimal"
                        aria-label={`Price for ${VEHICLE_CLASS_LABELS[vc]}`}
                        placeholder="—"
                        className="h-10 w-28 rounded-lg border border-border bg-surface-raised px-2 text-right tabular-nums focus:border-primary"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        name={`duration-${vc}`}
                        defaultValue={row.durationMinutes}
                        inputMode="numeric"
                        aria-label={`Time for ${VEHICLE_CLASS_LABELS[vc]}`}
                        placeholder="—"
                        className="h-10 w-24 rounded-lg border border-border bg-surface-raised px-2 text-right tabular-nums focus:border-primary"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormSection>

      <FormSection
        title="Fallback price"
        description="Used when none of the vehicle sizes above match, or when the job is priced the same for everyone."
      >
        <FormRow>
          <Field label="Base price (Rs.)" error={err("basePrice")}>
            {(p) => (
              <Input
                {...p}
                name="basePrice"
                defaultValue={values.basePrice}
                inputMode="decimal"
                className="tabular-nums"
              />
            )}
          </Field>
          <Field label="Typical time (mins)" error={err("durationMinutes")}>
            {(p) => (
              <Input
                {...p}
                name="durationMinutes"
                defaultValue={values.durationMinutes}
                inputMode="numeric"
                className="tabular-nums"
              />
            )}
          </Field>
        </FormRow>
        <CheckboxField
          name="priceFrom"
          label={'Show as "from Rs. X"'}
          hint="Use when the final price depends on the vehicle or condition."
          defaultChecked={values.priceFrom}
        />
      </FormSection>

      <FormSection title="Visibility">
        <CheckboxField
          name="isActive"
          label="Active"
          hint="Unticked services are hidden from the website."
          defaultChecked={values.isActive}
        />
        <CheckboxField
          name="isFeatured"
          label="Featured"
          hint="Highlighted on the home page."
          defaultChecked={values.isFeatured}
        />
      </FormSection>

      <FormSection title="Search engines" description="Optional.">
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
          {isNew ? "Create service" : "Save changes"}
        </Button>
        <Link
          href="/admin/services"
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
