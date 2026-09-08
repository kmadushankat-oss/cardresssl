"use client";

import { Mail, MessageSquare, Phone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import type { EnquiryStatus } from "@/generated/prisma/enums";
import { cn, toWhatsAppNumber } from "@/lib/utils";

import { deleteEnquiry, saveEnquiryNotes, setEnquiryStatus } from "./actions";

const LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "Being handled",
  RESPONDED: "Responded",
  CLOSED: "Closed",
  SPAM: "Spam",
};

const TONES: Record<EnquiryStatus, "warning" | "brand" | "success" | "neutral" | "danger"> = {
  NEW: "warning",
  IN_PROGRESS: "brand",
  RESPONDED: "success",
  CLOSED: "neutral",
  SPAM: "danger",
};

export function EnquiryCard({
  enquiry,
  canManage,
}: {
  enquiry: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    subject: string | null;
    message: string;
    status: EnquiryStatus;
    source: string;
    internalNotes: string | null;
    assignedToName: string | null;
    createdAt: string;
  };
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  function finish(result: { ok: boolean; error?: string }) {
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That did not work.");
      return;
    }
    setError(null);
    startTransition(() => router.refresh());
  }

  async function onStatus(status: EnquiryStatus) {
    setBusy(true);
    setError(null);
    finish(await setEnquiryStatus({ id: enquiry.id, status }));
  }

  async function onDelete() {
    if (
      !window.confirm(
        `Delete this spam enquiry from ${enquiry.name}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    finish(await deleteEnquiry({ id: enquiry.id }));
  }

  async function onSaveNotes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await saveEnquiryNotes({
      id: enquiry.id,
      internalNotes: String(form.get("internalNotes") ?? ""),
    });
    finish(result);
    if (result.ok) setNotesOpen(false);
  }

  const created = new Date(enquiry.createdAt);

  return (
    <article
      className={cn(
        "rounded-card border bg-surface-raised p-4",
        enquiry.status === "NEW" ? "border-warning/40" : "border-border",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{enquiry.name}</span>
            <Badge tone={TONES[enquiry.status]}>{LABELS[enquiry.status]}</Badge>
            {enquiry.assignedToName && (
              <Badge tone="info">{enquiry.assignedToName}</Badge>
            )}
            {enquiry.source !== "CONTACT_FORM" && (
              <Badge tone="neutral">{enquiry.source.toLowerCase().replace(/_/g, " ")}</Badge>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <a
              href={`tel:${enquiry.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground"
            >
              <Phone className="size-3.5" aria-hidden />
              {enquiry.phone}
            </a>
            <a
              href={`https://wa.me/${toWhatsAppNumber(enquiry.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground"
            >
              <MessageSquare className="size-3.5" aria-hidden />
              WhatsApp
            </a>
            {enquiry.email && (
              <a
                href={`mailto:${enquiry.email}?subject=${encodeURIComponent(
                  `Re: ${enquiry.subject ?? "Your enquiry"}`,
                )}`}
                className="inline-flex items-center gap-1 truncate text-foreground-muted hover:text-foreground"
              >
                <Mail className="size-3.5" aria-hidden />
                {enquiry.email}
              </a>
            )}
          </p>
        </div>

        <time
          dateTime={enquiry.createdAt}
          className="shrink-0 text-sm text-foreground-subtle"
          title={created.toLocaleString("en-GB")}
        >
          {created.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </time>
      </header>

      {enquiry.subject && (
        <p className="mt-2 text-sm font-medium">{enquiry.subject}</p>
      )}

      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground-muted">
        {enquiry.message}
      </p>

      {enquiry.internalNotes && !notesOpen && (
        <p className="mt-3 rounded-lg border border-dashed border-border p-2.5 text-sm text-foreground-muted">
          <span className="font-medium">Internal: </span>
          {enquiry.internalNotes}
        </p>
      )}

      {notesOpen && (
        <form onSubmit={onSaveNotes} className="mt-3">
          <label htmlFor={`enq-notes-${enquiry.id}`} className="text-sm font-medium">
            Internal notes
          </label>
          <textarea
            id={`enq-notes-${enquiry.id}`}
            name="internalNotes"
            defaultValue={enquiry.internalNotes ?? ""}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2.5 text-sm focus:border-primary"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Save notes
            </button>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="h-9 rounded-lg px-3 text-sm text-foreground-muted hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {canManage && (
        <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
          {(["IN_PROGRESS", "RESPONDED", "CLOSED", "SPAM"] as EnquiryStatus[])
            .filter((s) => s !== enquiry.status)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStatus(s)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm font-medium",
                  s === "RESPONDED"
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"
                    : "border-border text-foreground-muted hover:bg-surface hover:text-foreground",
                )}
              >
                {s === "SPAM" ? "Mark spam" : LABELS[s]}
              </button>
            ))}

          {!notesOpen && (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="h-9 rounded-lg px-3 text-sm text-foreground-muted hover:bg-surface hover:text-foreground"
            >
              {enquiry.internalNotes ? "Edit notes" : "Add notes"}
            </button>
          )}

          {/* Only junk is deletable — a real enquiry is closed, not erased. */}
          {enquiry.status === "SPAM" && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </button>
          )}
        </footer>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </article>
  );
}
