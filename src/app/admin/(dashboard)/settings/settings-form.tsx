"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormActions, FormMessage, FormRow, FormSection } from "@/components/admin/form-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { SettingKey, Settings } from "@/lib/settings";

import { saveSettings } from "./actions";

type FieldSpec = {
  key: SettingKey;
  label: string;
  hint?: string;
  type?: "text" | "textarea" | "tel" | "email" | "url" | "number";
  placeholder?: string;
  half?: boolean;
};

type SectionSpec = {
  title: string;
  description?: string;
  fields: FieldSpec[];
};

/**
 * The settings form, described as data.
 *
 * Everything the owner can change without a deploy: phone numbers, opening
 * hours, the WhatsApp number the sticky mobile button dials.
 */
const SECTIONS: SectionSpec[] = [
  {
    title: "Business",
    fields: [
      { key: "site.name", label: "Business name" },
      { key: "site.tagline", label: "Tagline", hint: "Shown under the logo." },
      { key: "site.description", label: "Description", type: "textarea" },
    ],
  },
  {
    title: "Contact",
    description:
      "These drive the click-to-call and WhatsApp buttons, so get the format right.",
    fields: [
      {
        key: "contact.phone",
        label: "Main phone",
        type: "tel",
        placeholder: "011 2 179 595",
        half: true,
      },
      { key: "contact.phoneAlt", label: "Second phone", type: "tel", half: true },
      {
        key: "contact.whatsapp",
        label: "WhatsApp number",
        type: "tel",
        placeholder: "071 990 7799",
        hint: "Any format — it is converted to +94 for the wa.me link.",
        half: true,
      },
      { key: "contact.email", label: "Email", type: "email", half: true },
      { key: "contact.addressLine1", label: "Address line 1" },
      { key: "contact.addressLine2", label: "Address line 2" },
      { key: "contact.city", label: "City", half: true },
      {
        key: "contact.mapEmbedUrl",
        label: "Google Maps embed URL",
        type: "url",
        hint: "In Google Maps: Share → Embed a map → copy the src URL.",
      },
    ],
  },
  {
    title: "Opening hours",
    fields: [
      { key: "hours.weekday", label: "Monday to Friday", half: true },
      { key: "hours.saturday", label: "Saturday", half: true },
      { key: "hours.sunday", label: "Sunday", half: true },
      {
        key: "hours.note",
        label: "Note",
        hint: "e.g. closed on public holidays.",
        half: true,
      },
    ],
  },
  {
    title: "Social media",
    description: "Full URLs. Leave blank to hide the icon.",
    fields: [
      { key: "social.facebook", label: "Facebook", type: "url", half: true },
      { key: "social.instagram", label: "Instagram", type: "url", half: true },
      { key: "social.tiktok", label: "TikTok", type: "url", half: true },
      { key: "social.youtube", label: "YouTube", type: "url", half: true },
    ],
  },
  {
    title: "Pricing and tax",
    fields: [
      { key: "commerce.currency", label: "Currency code", half: true },
      {
        key: "commerce.defaultTaxRate",
        label: "Default tax rate (%)",
        type: "number",
        half: true,
      },
      {
        key: "commerce.showPricesToPublic",
        label: "Show prices publicly",
        hint: 'Type "true" or "false".',
        half: true,
      },
      {
        key: "commerce.enquiryOnly",
        label: "Enquiry only (no online payment)",
        hint: 'Type "true" or "false".',
        half: true,
      },
    ],
  },
  {
    title: "Bookings",
    fields: [
      {
        key: "booking.leadTimeHours",
        label: "Minimum notice (hours)",
        type: "number",
        hint: "How far ahead a customer must book.",
        half: true,
      },
      {
        key: "booking.slots",
        label: "Time slots",
        hint: "Comma-separated, 24-hour, e.g. 08:30,10:00,11:30",
      },
    ],
  },
];

export function SettingsForm({
  settings,
  canEdit,
}: {
  settings: Settings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const form = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const section of SECTIONS) {
      for (const field of section.fields) {
        values[field.key] = String(form.get(field.key) ?? "");
      }
    }

    const result = await saveSettings({ values: values as Settings });

    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }

    setStatus({
      kind: "success",
      text: result.data.changed
        ? `Saved ${result.data.changed} change${result.data.changed === 1 ? "" : "s"}.`
        : "No changes to save.",
    });
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormMessage status={status} />

      {SECTIONS.map((section) => {
        const halves = section.fields.filter((f) => f.half);
        const fulls = section.fields.filter((f) => !f.half);

        return (
          <FormSection
            key={section.title}
            title={section.title}
            description={section.description}
          >
            {/* Pair the half-width fields up, keeping declaration order. */}
            {chunk(halves, 2).map((pair, i) => (
              <FormRow key={i}>
                {pair.map((field) => (
                  <SettingField
                    key={field.key}
                    field={field}
                    value={settings[field.key]}
                    disabled={!canEdit}
                  />
                ))}
              </FormRow>
            ))}
            {fulls.map((field) => (
              <SettingField
                key={field.key}
                field={field}
                value={settings[field.key]}
                disabled={!canEdit}
              />
            ))}
          </FormSection>
        );
      })}

      {canEdit && (
        <FormActions>
          <Button type="submit" loading={pending}>
            Save settings
          </Button>
        </FormActions>
      )}
    </form>
  );
}

function SettingField({
  field,
  value,
  disabled,
}: {
  field: FieldSpec;
  value: string;
  disabled: boolean;
}) {
  return (
    <Field label={field.label} hint={field.hint}>
      {(p) =>
        field.type === "textarea" ? (
          <Textarea
            {...p}
            name={field.key}
            defaultValue={value}
            rows={3}
            disabled={disabled}
            placeholder={field.placeholder}
          />
        ) : (
          <Input
            {...p}
            name={field.key}
            type={field.type === "number" ? "text" : (field.type ?? "text")}
            inputMode={field.type === "number" ? "numeric" : undefined}
            defaultValue={value}
            disabled={disabled}
            placeholder={field.placeholder}
          />
        )
      }
    </Field>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
