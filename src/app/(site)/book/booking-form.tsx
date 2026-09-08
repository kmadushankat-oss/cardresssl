"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FormMessage, FormRow } from "@/components/admin/form-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

import { submitBooking } from "./actions";

type ServiceOption = { slug: string; name: string };
type Category = { name: string; services: ServiceOption[] };

export function BookingForm({
  categories,
  slots,
  leadTimeHours,
  preselectedService,
}: {
  categories: Category[];
  slots: string[];
  leadTimeHours: number;
  preselectedService?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reference, setReference] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>(
    preselectedService ? [preselectedService] : [],
  );

  /** Earliest bookable day, honouring the configured lead time. */
  const minDate = (() => {
    const d = new Date(Date.now() + leadTimeHours * 3_600_000);
    return d.toISOString().slice(0, 10);
  })();

  const maxDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  })();

  function toggleService(slug: string) {
    setChosen((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "");

    const result = await submitBooking({
      contactName: read("contactName"),
      contactPhone: read("contactPhone"),
      contactEmail: read("contactEmail"),
      vehicleMake: read("vehicleMake"),
      vehicleModel: read("vehicleModel"),
      vehicleYear: read("vehicleYear"),
      vehicleRegistration: read("vehicleRegistration"),
      serviceSlugs: chosen,
      preferredDate: read("preferredDate"),
      preferredTime: read("preferredTime"),
      notes: read("notes"),
      website: read("website"),
    });

    setBusy(false);

    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setFieldErrors(result.fieldErrors ?? {});
      const first = Object.keys(result.fieldErrors ?? {})[0];
      if (first) {
        document
          .querySelector<HTMLElement>(`[name="${first}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setReference(result.data.bookingNumber);
  }

  // Success replaces the form entirely — leaving it on screen invites a
  // double submission.
  if (reference) {
    return (
      <div className="rounded-card border border-success/40 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">Request received</h2>
        <p className="mt-2 text-foreground-muted">
          Your reference is{" "}
          <strong className="font-mono text-foreground">{reference}</strong>. We
          will call you to confirm a time.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/services"
            className="inline-flex h-11 items-center rounded-lg border border-border bg-surface-raised px-4 text-sm font-medium hover:bg-surface"
          >
            Browse services
          </Link>
          <Link
            href="/parts"
            className="inline-flex h-11 items-center rounded-lg border border-border bg-surface-raised px-4 text-sm font-medium hover:bg-surface"
          >
            Shop spare parts
          </Link>
        </div>
      </div>
    );
  }

  const err = (name: string) => fieldErrors[name]?.[0];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormMessage status={status} />

      <fieldset className="rounded-card border border-border bg-surface-raised p-5">
        <legend className="px-1 text-sm font-semibold">Your details</legend>

        <div className="mt-2 space-y-4">
          <FormRow>
            <Field label="Your name" required error={err("contactName")}>
              {(p) => (
                <Input {...p} name="contactName" required autoComplete="name" />
              )}
            </Field>
            <Field
              label="Phone number"
              required
              error={err("contactPhone")}
              hint="We will call this number to confirm."
            >
              {(p) => (
                <Input
                  {...p}
                  name="contactPhone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="077 123 4567"
                />
              )}
            </Field>
          </FormRow>

          <Field
            label="Email"
            error={err("contactEmail")}
            hint="Optional — for a written confirmation."
          >
            {(p) => (
              <Input
                {...p}
                name="contactEmail"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-card border border-border bg-surface-raised p-5">
        <legend className="px-1 text-sm font-semibold">Your vehicle</legend>
        <p className="mt-1 text-sm text-foreground-muted">
          All optional, but it helps us quote accurately and have the right parts
          ready.
        </p>

        <div className="mt-3 space-y-4">
          <FormRow>
            <Field label="Make" error={err("vehicleMake")}>
              {(p) => <Input {...p} name="vehicleMake" placeholder="Toyota" />}
            </Field>
            <Field label="Model" error={err("vehicleModel")}>
              {(p) => <Input {...p} name="vehicleModel" placeholder="Aqua" />}
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Year" error={err("vehicleYear")}>
              {(p) => (
                <Input
                  {...p}
                  name="vehicleYear"
                  inputMode="numeric"
                  placeholder="2015"
                />
              )}
            </Field>
            <Field label="Registration number" error={err("vehicleRegistration")}>
              {(p) => (
                <Input
                  {...p}
                  name="vehicleRegistration"
                  placeholder="CAB-1234"
                  className="uppercase"
                />
              )}
            </Field>
          </FormRow>
        </div>
      </fieldset>

      {categories.length > 0 && (
        <fieldset className="rounded-card border border-border bg-surface-raised p-5">
          <legend className="px-1 text-sm font-semibold">
            What do you need? {chosen.length > 0 && `(${chosen.length} selected)`}
          </legend>
          <p className="mt-1 text-sm text-foreground-muted">
            Pick anything that applies, or leave it blank and tell us below.
          </p>

          <div className="mt-3 space-y-4">
            {categories.map((category) => (
              <div key={category.name}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                  {category.name}
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {category.services.slice(0, 24).map((service) => {
                    const active = chosen.includes(service.slug);
                    return (
                      <li key={service.slug}>
                        <button
                          type="button"
                          onClick={() => toggleService(service.slug)}
                          aria-pressed={active}
                          className={
                            active
                              ? "inline-flex min-h-9 items-center rounded-full border border-primary bg-primary/12 px-3 py-1.5 text-sm font-medium text-primary-text"
                              : "inline-flex min-h-9 items-center rounded-full border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface hover:text-foreground"
                          }
                        >
                          {service.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="rounded-card border border-border bg-surface-raised p-5">
        <legend className="px-1 text-sm font-semibold">When suits you?</legend>

        <div className="mt-2 space-y-4">
          <FormRow>
            <Field label="Preferred date" required error={err("preferredDate")}>
              {(p) => (
                <Input
                  {...p}
                  name="preferredDate"
                  type="date"
                  required
                  min={minDate}
                  max={maxDate}
                />
              )}
            </Field>
            <Field label="Preferred time" error={err("preferredTime")}>
              {(p) =>
                slots.length > 0 ? (
                  <Select {...p} name="preferredTime">
                    <option value="">Any time</option>
                    {slots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input {...p} name="preferredTime" placeholder="e.g. morning" />
                )
              }
            </Field>
          </FormRow>

          <Field
            label="Anything else we should know?"
            error={err("notes")}
            hint="Symptoms, noises, when it started — whatever helps."
          >
            {(p) => <Textarea {...p} name="notes" rows={4} />}
          </Field>
        </div>
      </fieldset>

      {/*
        Honeypot. Hidden from people but visible to naive bots, which fill in
        every field they find. Cheaper and far less annoying than a CAPTCHA.
      */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" loading={busy} className="h-12 w-full sm:w-auto">
          Request booking
        </Button>
        <p className="text-sm text-foreground-muted">
          No payment now — we confirm the price with you first.
        </p>
      </div>
    </form>
  );
}
