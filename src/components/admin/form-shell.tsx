"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A titled group of fields. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-border bg-surface-raised p-5 sm:p-6",
        className,
      )}
    >
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-foreground-muted">{description}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Two fields side by side above `sm`, stacked below. */
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function FormMessage({
  status,
}: {
  status: { kind: "error" | "success"; text: string } | null;
}) {
  if (!status) return null;

  const isError = status.kind === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        isError
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-success/40 bg-success/10 text-success",
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span>{status.text}</span>
    </div>
  );
}

/**
 * Sticky action bar for a long form.
 *
 * The product form is tall enough to scroll well past a footer button, and
 * hunting for Save is exactly the friction that stops someone enriching 150
 * products in a sitting.
 */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center gap-3",
        "border-t border-border bg-background/95 px-4 py-3 backdrop-blur",
        "pb-safe sm:-mx-6 sm:px-6",
      )}
    >
      {children}
    </div>
  );
}

/** Checkbox with a label and optional hint, aligned to the text baseline. */
export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const id = `check-${name}`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        value="true"
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-4 shrink-0 rounded border-border text-primary accent-primary"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-foreground-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
