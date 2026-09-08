import { Clock, Phone } from "lucide-react";
import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

import { BookingForm } from "./booking-form";

export const metadata: Metadata = {
  title: "Book a service",
  description:
    "Request a service booking — servicing, repairs, body work or detailing. We call you back to confirm.",
};

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const params = await searchParams;
  const preselect =
    typeof params.service === "string" ? params.service : undefined;

  const [categories, settings] = await Promise.all([
    db.serviceCategory.findMany({
      where: { isActive: true, services: { some: { isActive: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        services: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { slug: true, name: true },
        },
      },
    }),
    getSettings(),
  ]);

  const slots = (settings["booking.slots"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const leadTimeHours =
    Number.parseInt(settings["booking.leadTimeHours"] || "0", 10) || 0;

  const hours = [
    { label: "Mon – Fri", value: settings["hours.weekday"] },
    { label: "Saturday", value: settings["hours.saturday"] },
    { label: "Sunday", value: settings["hours.sunday"] },
  ].filter((h) => h.value);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Book a service</h1>
        <p className="mt-2 text-foreground-muted">
          Tell us what you need and when suits you. We will call you back to
          confirm a time — this form does not lock in a slot by itself.
        </p>
      </header>

      {(hours.length > 0 || settings["contact.phone"]) && (
        <div className="mb-6 flex flex-col gap-3 rounded-card border border-border bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          {hours.length > 0 && (
            <p className="flex items-start gap-2 text-foreground-muted">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {hours.map((h) => (
                  <span key={h.label} className="block">
                    {h.label}: {h.value}
                  </span>
                ))}
              </span>
            </p>
          )}
          {settings["contact.phone"] && (
            <a
              href={`tel:${settings["contact.phone"].replace(/\s/g, "")}`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-4 font-medium hover:bg-surface"
            >
              <Phone className="size-4" aria-hidden />
              Or call {settings["contact.phone"]}
            </a>
          )}
        </div>
      )}

      <BookingForm
        categories={categories}
        slots={slots}
        leadTimeHours={leadTimeHours}
        preselectedService={preselect}
      />
    </div>
  );
}
