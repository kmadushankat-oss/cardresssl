import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";

import { ListToolbar } from "@/components/admin/list-toolbar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import type { BookingStatus, Prisma } from "@/generated/prisma/client";
import { BOOKING_STATUS_LABELS, BOOKING_STATUSES } from "@/lib/booking-status";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

import { BookingCard } from "./booking-card";

export const metadata: Metadata = { title: "Bookings" };

const PAGE_SIZE = 20;

export default async function BookingsPage({
  searchParams,
}: PageProps<"/admin/bookings">) {
  const user = await requirePermission("booking:view");
  const params = await searchParams;

  const str = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const status = str("status") as BookingStatus | undefined;
  const when = str("when");
  const q = str("q");
  const page = Math.max(1, Number.parseInt(str("page") ?? "1", 10) || 1);

  const clauses: Prisma.BookingWhereInput[] = [];

  if (status) clauses.push({ status });

  if (q?.trim()) {
    const term = q.trim();
    clauses.push({
      OR: [
        { bookingNumber: { contains: term, mode: "insensitive" } },
        { contactName: { contains: term, mode: "insensitive" } },
        { contactPhone: { contains: term, mode: "insensitive" } },
        { vehicleRegistration: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  // Day boundaries in the server's zone; the workshop is single-site.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (when === "today") {
    clauses.push({ preferredDate: { gte: startOfToday, lt: startOfTomorrow } });
  } else if (when === "upcoming") {
    clauses.push({ preferredDate: { gte: startOfToday } });
  } else if (when === "overdue") {
    // Still awaiting action although the requested date has passed — the set
    // most likely to embarrass someone if it goes unnoticed.
    clauses.push({
      preferredDate: { lt: startOfToday },
      status: { in: ["PENDING", "CONFIRMED"] },
    });
  }

  const where: Prisma.BookingWhereInput = clauses.length ? { AND: clauses } : {};

  const [bookings, total, staff, counts] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: [{ preferredDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        services: { include: { service: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
    db.booking.count({ where }),
    db.user.findMany({
      where: {
        isActive: true,
        role: { in: ["OWNER", "ADMIN", "MANAGER", "SERVICE_ADVISOR", "MECHANIC"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    db.booking.groupBy({ by: ["status"], _count: true }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count]));

  const buildHref = (nextPage: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) qs.set(key, value);
    }
    if (nextPage > 1) qs.set("page", String(nextPage));
    else qs.delete("page");
    const s = qs.toString();
    return s ? `/admin/bookings?${s}` : "/admin/bookings";
  };

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={`${total} booking${total === 1 ? "" : "s"} matching this view`}
      />

      <ListToolbar
        searchPlaceholder="Search number, name, phone or registration…"
        filters={[
          {
            name: "status",
            label: "Status",
            options: BOOKING_STATUSES.map((s) => ({
              value: s,
              label: `${BOOKING_STATUS_LABELS[s]}${
                countByStatus.get(s) ? ` (${countByStatus.get(s)})` : ""
              }`,
            })),
          },
          {
            name: "when",
            label: "When",
            options: [
              { value: "today", label: "Today" },
              { value: "upcoming", label: "Upcoming" },
              { value: "overdue", label: "Overdue" },
            ],
          },
        ]}
      />

      {bookings.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface">
            <CalendarCheck className="size-5 text-foreground-muted" aria-hidden />
          </div>
          <h2 className="font-display font-semibold">
            {Object.keys(params).length ? "No bookings match this view" : "No bookings yet"}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {Object.keys(params).length
              ? "Try clearing a filter."
              : "Bookings will appear here once the booking form goes live on the website."}
          </p>
        </div>
      ) : (
        <>
          <ul className="mb-4 space-y-3">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={{
                    id: booking.id,
                    bookingNumber: booking.bookingNumber,
                    status: booking.status,
                    contactName: booking.contactName,
                    contactPhone: booking.contactPhone,
                    contactEmail: booking.contactEmail,
                    vehicle: [
                      booking.vehicleMake,
                      booking.vehicleModel,
                      booking.vehicleYear?.toString(),
                    ]
                      .filter(Boolean)
                      .join(" "),
                    registration: booking.vehicleRegistration,
                    preferredDate: booking.preferredDate.toISOString(),
                    preferredTime: booking.preferredTime,
                    notes: booking.notes,
                    internalNotes: booking.internalNotes,
                    cancelReason: booking.cancelReason,
                    serviceNames: booking.services.map((s) => s.service.name),
                    assignedToId: booking.assignedTo?.id ?? null,
                    assignedToName: booking.assignedTo?.name ?? null,
                  }}
                  staff={staff}
                  canUpdate={can(user.role, "booking:update")}
                  canAssign={can(user.role, "booking:assign")}
                />
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            total={total}
            pageSize={PAGE_SIZE}
            buildHref={buildHref}
          />
        </>
      )}
    </div>
  );
}
