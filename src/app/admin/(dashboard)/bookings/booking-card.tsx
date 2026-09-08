"use client";

import { Car, Clock, Mail, MessageSquare, Phone, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/generated/prisma/enums";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TONES,
  isTerminal,
  nextStatuses,
} from "@/lib/booking-status";
import { cn, toWhatsAppNumber } from "@/lib/utils";

import { assignBooking, saveBookingNotes, setBookingStatus } from "./actions";

export type BookingCardData = {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  vehicle: string;
  registration: string | null;
  preferredDate: string;
  preferredTime: string | null;
  notes: string | null;
  internalNotes: string | null;
  cancelReason: string | null;
  serviceNames: string[];
  assignedToId: string | null;
  assignedToName: string | null;
};

export function BookingCard({
  booking,
  staff,
  canUpdate,
  canAssign,
}: {
  booking: BookingCardData;
  staff: { id: string; name: string; role: string }[];
  canUpdate: boolean;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const date = new Date(booking.preferredDate);
  const options = nextStatuses(booking.status);

  function finish(result: { ok: boolean; error?: string }) {
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That did not work.");
      return;
    }
    setError(null);
    startTransition(() => router.refresh());
  }

  async function onStatus(next: BookingStatus) {
    let reason: string | undefined;
    if (next === "CANCELLED") {
      const entered = window.prompt(
        `Why is ${booking.bookingNumber} being cancelled? (optional)`,
      );
      // A null here means they pressed Cancel on the prompt, not "no reason".
      if (entered === null) return;
      reason = entered;
    }
    setBusy(true);
    setError(null);
    finish(await setBookingStatus({ id: booking.id, status: next, cancelReason: reason }));
  }

  async function onAssign(assignedToId: string) {
    setBusy(true);
    setError(null);
    finish(await assignBooking({ id: booking.id, assignedToId }));
  }

  async function onSaveNotes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await saveBookingNotes({
      id: booking.id,
      internalNotes: String(form.get("internalNotes") ?? ""),
    });
    finish(result);
    if (result.ok) setNotesOpen(false);
  }

  return (
    <article
      className={cn(
        "rounded-card border border-border bg-surface-raised p-4",
        busy && "pointer-events-none opacity-60",
        booking.status === "CANCELLED" && "opacity-75",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium">{booking.bookingNumber}</span>
            <Badge tone={BOOKING_STATUS_TONES[booking.status]}>
              {BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
            {booking.assignedToName && (
              <Badge tone="info">
                <User className="size-3" aria-hidden />
                {booking.assignedToName}
              </Badge>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">{booking.contactName}</span>
            <a
              href={`tel:${booking.contactPhone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground"
            >
              <Phone className="size-3.5" aria-hidden />
              {booking.contactPhone}
            </a>
            <a
              href={`https://wa.me/${toWhatsAppNumber(booking.contactPhone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground-muted hover:text-foreground"
            >
              <MessageSquare className="size-3.5" aria-hidden />
              WhatsApp
            </a>
            {booking.contactEmail && (
              <a
                href={`mailto:${booking.contactEmail}`}
                className="inline-flex items-center gap-1 truncate text-foreground-muted hover:text-foreground"
              >
                <Mail className="size-3.5" aria-hidden />
                {booking.contactEmail}
              </a>
            )}
          </p>
        </div>

        <p className="flex shrink-0 items-center gap-1.5 text-sm text-foreground-muted">
          <Clock className="size-3.5" aria-hidden />
          {date.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
          {booking.preferredTime ? ` · ${booking.preferredTime}` : ""}
        </p>
      </header>

      {(booking.vehicle || booking.registration) && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-foreground-muted">
          <Car className="size-3.5" aria-hidden />
          {booking.vehicle || "Vehicle not given"}
          {booking.registration && (
            <span className="font-mono text-xs">· {booking.registration}</span>
          )}
        </p>
      )}

      {booking.serviceNames.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {booking.serviceNames.map((name) => (
            <li key={name}>
              <Badge tone="neutral">{name}</Badge>
            </li>
          ))}
        </ul>
      )}

      {booking.notes && (
        <p className="mt-3 rounded-lg bg-surface p-2.5 text-sm">
          <span className="font-medium">Customer note: </span>
          {booking.notes}
        </p>
      )}

      {booking.cancelReason && (
        <p className="mt-2 text-sm text-foreground-muted">
          <span className="font-medium">Cancelled: </span>
          {booking.cancelReason}
        </p>
      )}

      {booking.internalNotes && !notesOpen && (
        <p className="mt-2 rounded-lg border border-dashed border-border p-2.5 text-sm text-foreground-muted">
          <span className="font-medium">Internal: </span>
          {booking.internalNotes}
        </p>
      )}

      {notesOpen && (
        <form onSubmit={onSaveNotes} className="mt-3">
          <label htmlFor={`notes-${booking.id}`} className="text-sm font-medium">
            Internal notes
          </label>
          <textarea
            id={`notes-${booking.id}`}
            name="internalNotes"
            defaultValue={booking.internalNotes ?? ""}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2.5 text-sm focus:border-primary"
            placeholder="Not shown to the customer."
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

      {(canUpdate || canAssign) && (
        <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
          {canUpdate &&
            options.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => onStatus(next)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm font-medium",
                  next === "CANCELLED" || next === "NO_SHOW"
                    ? "border-border text-foreground-muted hover:bg-surface"
                    : "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
                )}
              >
                {next === "PENDING" ? "Reopen" : BOOKING_STATUS_LABELS[next]}
              </button>
            ))}

          {canUpdate && isTerminal(booking.status) && (
            <span className="text-sm text-foreground-subtle">
              Completed — no further changes
            </span>
          )}

          {canAssign && (
            <label className="ml-auto text-sm">
              <span className="sr-only">Assign {booking.bookingNumber} to</span>
              <select
                value={booking.assignedToId ?? ""}
                onChange={(e) => onAssign(e.target.value)}
                className="h-9 rounded-lg border border-border bg-surface-raised px-2 pr-7 text-sm"
              >
                <option value="">Unassigned</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {canUpdate && !notesOpen && (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="h-9 rounded-lg px-3 text-sm text-foreground-muted hover:bg-surface hover:text-foreground"
            >
              {booking.internalNotes ? "Edit notes" : "Add notes"}
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
