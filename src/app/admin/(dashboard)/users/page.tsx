import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import {
  can,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
} from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

import { NewStaffButton } from "./new-staff-button";
import { UserRow } from "./user-row";

export const metadata: Metadata = { title: "Staff & roles" };

export default async function UsersPage() {
  const viewer = await requirePermission("user:view");

  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { accounts: true } },
    },
  });

  const staff = users.filter((u) => u.role !== "CUSTOMER");
  const customers = users.filter((u) => u.role === "CUSTOMER");
  const activeOwners = users.filter((u) => u.role === "OWNER" && u.isActive).length;

  return (
    <div>
      <PageHeader
        title="Staff & roles"
        description={`${staff.length} staff account${staff.length === 1 ? "" : "s"}${
          customers.length ? ` · ${customers.length} customer account${customers.length === 1 ? "" : "s"}` : ""
        }`}
        actions={
          can(viewer.role, "user:create") && (
            <NewStaffButton canCreateOwner={viewer.role === "OWNER"} />
          )
        }
      />

      <div className="mb-5 space-y-3">
        {staff.map((user) => (
          <UserRow
            key={user.id}
            user={{
              ...user,
              lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
              hasPassword: user._count.accounts > 0,
            }}
            isSelf={user.id === viewer.id}
            canChangeRole={can(viewer.role, "user:changeRole")}
            canUpdate={can(viewer.role, "user:update")}
            canDelete={can(viewer.role, "user:delete")}
            isLastActiveOwner={user.role === "OWNER" && activeOwners <= 1}
          />
        ))}
      </div>

      {customers.length > 0 && (
        <details className="mb-5 rounded-card border border-border bg-surface-raised p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {customers.length} customer account
            {customers.length === 1 ? "" : "s"} (no dashboard access)
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-foreground-muted">
            {customers.slice(0, 50).map((c) => (
              <li key={c.id}>
                {c.name} — {c.email}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* The permission matrix, so whoever assigns a role can see what it grants. */}
      <section className="rounded-card border border-border bg-surface-raised p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          What each role can do
        </h2>
        <dl className="mt-4 space-y-3">
          {STAFF_ROLES.map((role) => (
            <div
              key={role}
              className="border-b border-border-subtle pb-3 last:border-0 last:pb-0"
            >
              <dt className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{ROLE_LABELS[role]}</span>
                <Badge tone="info">
                  {ROLE_PERMISSIONS[role].length} permissions
                </Badge>
              </dt>
              <dd className="mt-0.5 text-sm text-foreground-muted">
                {ROLE_DESCRIPTIONS[role]}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
