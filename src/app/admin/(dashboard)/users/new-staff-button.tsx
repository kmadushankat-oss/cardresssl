"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { FormMessage } from "@/components/admin/form-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, STAFF_ROLES } from "@/lib/permissions";

import { createStaffUser } from "./actions";

/** Suggest a strong password rather than letting someone type "password1". */
function suggestPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const body = btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, "")
    .slice(0, 10);
  return `Cd-${body}1!`;
}

export function NewStaffButton({ canCreateOwner }: { canCreateOwner: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [password, setPassword] = useState(suggestPassword);
  const [role, setRole] = useState<string>("MECHANIC");

  // Use the native dialog so focus trapping and Escape come for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const result = await createStaffUser({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      role: String(form.get("role") ?? "MECHANIC") as (typeof STAFF_ROLES)[number],
      password: String(form.get("password") ?? ""),
    });

    setSaving(false);

    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setStatus({
      kind: "success",
      text: `Created ${result.data.email}. Give them the password — they should change it after signing in.`,
    });
    startTransition(() => router.refresh());
  }

  const err = (name: string) => fieldErrors[name]?.[0];

  const roles = canCreateOwner
    ? STAFF_ROLES
    : STAFF_ROLES.filter((r) => r !== "OWNER");

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add staff
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-labelledby="new-staff-title"
        className="w-[min(32rem,calc(100vw-2rem))] rounded-card border border-border bg-surface-raised p-0 text-foreground backdrop:bg-ink-950/60"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="new-staff-title" className="font-display font-semibold">
            Add a staff account
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-lg text-foreground-muted hover:bg-surface"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
          <FormMessage status={status} />

          <Field label="Full name" required error={err("name")}>
            {(p) => <Input {...p} name="name" required />}
          </Field>

          <Field label="Email address" required error={err("email")}>
            {(p) => (
              <Input
                {...p}
                name="email"
                type="email"
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            )}
          </Field>

          <Field label="Phone" error={err("phone")}>
            {(p) => <Input {...p} name="phone" type="tel" />}
          </Field>

          <Field label="Role" required error={err("role")} hint={ROLE_DESCRIPTIONS[role as (typeof STAFF_ROLES)[number]]}>
            {(p) => (
              <Select
                {...p}
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Temporary password"
            required
            error={err("password")}
            hint="Share this with them directly. They should change it after signing in."
          >
            {(p) => (
              <div className="flex gap-2">
                <Input
                  {...p}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="font-mono"
                />
                <button
                  type="button"
                  onClick={() => setPassword(suggestPassword())}
                  className="h-11 shrink-0 rounded-lg border border-border px-3 text-sm hover:bg-surface"
                >
                  New
                </button>
              </div>
            )}
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" loading={saving || pending}>
              Create account
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 rounded-lg px-4 text-sm font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
            >
              Close
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
