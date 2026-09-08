"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { FormMessage, FormRow } from "@/components/admin/form-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

import { submitEnquiry } from "./actions";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "");

    const result = await submitEnquiry({
      name: read("name"),
      phone: read("phone"),
      email: read("email"),
      subject: read("subject"),
      message: read("message"),
      website: read("website"),
    });

    setBusy(false);

    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-card border border-success/40 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">Message sent</h2>
        <p className="mt-2 text-foreground-muted">
          Thanks — we will get back to you as soon as we can. If it is urgent,
          calling is always quicker.
        </p>
      </div>
    );
  }

  const err = (name: string) => fieldErrors[name]?.[0];

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4 rounded-card border border-border bg-surface-raised p-5"
    >
      <h2 className="text-lg font-semibold">Send us a message</h2>

      <FormMessage status={status} />

      <FormRow>
        <Field label="Your name" required error={err("name")}>
          {(p) => <Input {...p} name="name" required autoComplete="name" />}
        </Field>
        <Field label="Phone number" required error={err("phone")}>
          {(p) => (
            <Input
              {...p}
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 123 4567"
            />
          )}
        </Field>
      </FormRow>

      <Field label="Email" error={err("email")} hint="Optional.">
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
          />
        )}
      </Field>

      <Field label="Subject" error={err("subject")}>
        {(p) => (
          <Input {...p} name="subject" placeholder="e.g. Brake pads for a Toyota Aqua" />
        )}
      </Field>

      <Field label="Message" required error={err("message")}>
        {(p) => (
          <Textarea
            {...p}
            name="message"
            rows={5}
            required
            placeholder="Tell us what you need — the part, the vehicle, or the problem you are having."
          />
        )}
      </Field>

      {/* Honeypot — invisible to people, irresistible to bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <Button type="submit" loading={busy} className="h-12 w-full">
        Send message
      </Button>
    </form>
  );
}
