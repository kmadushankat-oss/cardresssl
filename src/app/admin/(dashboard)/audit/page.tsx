import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { ListToolbar } from "@/components/admin/list-toolbar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 50;

const ACTION_TONES: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  CREATE: "success",
  UPDATE: "info",
  REVIEW: "info",
  ASSIGN: "info",
  CHANGE_ROLE: "warning",
  RESET_PASSWORD: "warning",
  DELETE: "danger",
  LOGIN: "neutral",
};

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePermission("audit:view");
  const params = await searchParams;

  const str = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const entity = str("entity");
  const action = str("action");
  const userId = str("user");
  const q = str("q");
  const page = Math.max(1, Number.parseInt(str("page") ?? "1", 10) || 1);

  const clauses: Prisma.AuditLogWhereInput[] = [];
  if (entity) clauses.push({ entity });
  if (action) clauses.push({ action });
  if (userId) clauses.push({ userId });
  if (q?.trim()) clauses.push({ summary: { contains: q.trim(), mode: "insensitive" } });

  const where: Prisma.AuditLogWhereInput = clauses.length ? { AND: clauses } : {};

  const [entries, total, entities, actions, actors] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["entity"], _count: true, orderBy: { entity: "asc" } }),
    db.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
    db.user.findMany({
      where: { auditLogs: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const buildHref = (nextPage: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) qs.set(key, value);
    }
    if (nextPage > 1) qs.set("page", String(nextPage));
    else qs.delete("page");
    const s = qs.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <div>
      <PageHeader
        title="Activity log"
        description="Every change made in the dashboard, and who made it. Read-only."
      />

      <ListToolbar
        searchPlaceholder="Search what happened…"
        filters={[
          {
            name: "entity",
            label: "Type",
            options: entities.map((e) => ({
              value: e.entity,
              label: `${e.entity} (${e._count})`,
            })),
          },
          {
            name: "action",
            label: "Action",
            options: actions.map((a) => ({
              value: a.action,
              label: `${a.action.toLowerCase().replace(/_/g, " ")} (${a._count})`,
            })),
          },
          {
            name: "user",
            label: "Who",
            options: actors.map((a) => ({ value: a.id, label: a.name })),
          },
        ]}
      />

      {entries.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface-raised px-6 py-16 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface">
            <ScrollText className="size-5 text-foreground-muted" aria-hidden />
          </div>
          <h2 className="font-display font-semibold">
            {Object.keys(params).length ? "Nothing matches this view" : "No activity recorded yet"}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {Object.keys(params).length
              ? "Try clearing a filter."
              : "Changes made in the dashboard will be listed here."}
          </p>
        </div>
      ) : (
        <>
          <ol className="mb-4 space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <Badge tone={ACTION_TONES[entry.action] ?? "neutral"}>
                  {entry.action.toLowerCase().replace(/_/g, " ")}
                </Badge>

                <p className="min-w-0 flex-1 text-sm">
                  {entry.summary ?? (
                    <span className="text-foreground-muted">
                      {entry.entity}
                      {entry.entityId ? ` ${entry.entityId}` : ""}
                    </span>
                  )}
                </p>

                <p className="flex shrink-0 items-center gap-2 text-xs text-foreground-subtle">
                  <span>{entry.user?.name ?? "System"}</span>
                  <time
                    dateTime={entry.createdAt.toISOString()}
                    title={entry.createdAt.toLocaleString("en-GB")}
                  >
                    {entry.createdAt.toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </p>
              </li>
            ))}
          </ol>

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
