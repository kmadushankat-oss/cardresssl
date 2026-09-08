import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { ListToolbar } from "@/components/admin/list-toolbar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import type { EnquiryStatus, Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

import { EnquiryCard } from "./enquiry-card";

export const metadata: Metadata = { title: "Enquiries" };

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "Being handled" },
  { value: "RESPONDED", label: "Responded" },
  { value: "CLOSED", label: "Closed" },
  { value: "SPAM", label: "Spam" },
];

export default async function EnquiriesPage({
  searchParams,
}: PageProps<"/admin/enquiries">) {
  const user = await requirePermission("enquiry:view");
  const params = await searchParams;

  const str = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const status = str("status") as EnquiryStatus | undefined;
  const q = str("q");
  const page = Math.max(1, Number.parseInt(str("page") ?? "1", 10) || 1);

  const clauses: Prisma.EnquiryWhereInput[] = [];
  if (status) clauses.push({ status });
  else clauses.push({ status: { not: "SPAM" } }); // spam is opt-in to view

  if (q?.trim()) {
    const term = q.trim();
    clauses.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { message: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.EnquiryWhereInput = { AND: clauses };

  const [enquiries, total, counts] = await Promise.all([
    db.enquiry.findMany({
      where,
      // Newest first: an unanswered enquiry from this morning matters more than
      // one from last month.
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { assignedTo: { select: { name: true } } },
    }),
    db.enquiry.count({ where }),
    db.enquiry.groupBy({ by: ["status"], _count: true }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count]));
  const newCount = countByStatus.get("NEW") ?? 0;

  const buildHref = (nextPage: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) qs.set(key, value);
    }
    if (nextPage > 1) qs.set("page", String(nextPage));
    else qs.delete("page");
    const s = qs.toString();
    return s ? `/admin/enquiries?${s}` : "/admin/enquiries";
  };

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description={
          newCount > 0
            ? `${newCount} unanswered · ${total} in this view`
            : `${total} in this view`
        }
      />

      <ListToolbar
        searchPlaceholder="Search name, phone, email or message…"
        filters={[
          {
            name: "status",
            label: "Status",
            options: STATUS_OPTIONS.map((o) => ({
              value: o.value,
              label: `${o.label}${countByStatus.get(o.value) ? ` (${countByStatus.get(o.value)})` : ""}`,
            })),
          },
        ]}
      />

      {enquiries.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface">
            <Inbox className="size-5 text-foreground-muted" aria-hidden />
          </div>
          <h2 className="font-display font-semibold">
            {status || q ? "Nothing matches this view" : "No enquiries yet"}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {status || q
              ? "Try clearing the filter."
              : "Messages from the website contact form will arrive here."}
          </p>
        </div>
      ) : (
        <>
          <ul className="mb-4 space-y-3">
            {enquiries.map((enquiry) => (
              <li key={enquiry.id}>
                <EnquiryCard
                  enquiry={{
                    id: enquiry.id,
                    name: enquiry.name,
                    email: enquiry.email,
                    phone: enquiry.phone,
                    subject: enquiry.subject,
                    message: enquiry.message,
                    status: enquiry.status,
                    source: enquiry.source,
                    internalNotes: enquiry.internalNotes,
                    assignedToName: enquiry.assignedTo?.name ?? null,
                    createdAt: enquiry.createdAt.toISOString(),
                  }}
                  canManage={can(user.role, "enquiry:manage")}
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
