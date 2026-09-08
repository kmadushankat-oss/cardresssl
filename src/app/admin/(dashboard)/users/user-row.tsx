"use client";

import { KeyRound, Trash2, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/permissions";
import { cn } from "@/lib/utils";

import {
  changeUserRole,
  deleteUser,
  resetUserPassword,
  setUserActive,
} from "./actions";

type Role = (typeof STAFF_ROLES)[number] | "CUSTOMER";

export function UserRow({
  user,
  isSelf,
  canChangeRole,
  canUpdate,
  canDelete,
  isLastActiveOwner,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
    isActive: boolean;
    lastLoginAt: string | null;
    hasPassword: boolean;
  };
  isSelf: boolean;
  canChangeRole: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isLastActiveOwner: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done(result: { ok: boolean; error?: string }) {
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That did not work.");
      return;
    }
    setError(null);
    startTransition(() => router.refresh());
  }

  async function onRoleChange(role: string) {
    setBusy(true);
    setError(null);
    done(await changeUserRole({ id: user.id, role: role as Role }));
  }

  async function onToggleActive() {
    const next = !user.isActive;
    if (
      !next &&
      !window.confirm(
        `Deactivate ${user.email}? They will be signed out immediately and cannot sign in again.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    done(await setUserActive({ id: user.id, isActive: next }));
  }

  async function onResetPassword() {
    const password = window.prompt(
      `New password for ${user.email} (at least 8 characters).\n\nThey will be signed out and must use this to sign in.`,
    );
    if (!password) return;
    setBusy(true);
    setError(null);
    done(await resetUserPassword({ id: user.id, password }));
  }

  async function onDelete() {
    if (
      !window.confirm(
        `Permanently delete ${user.email}? This cannot be undone. Deactivating instead keeps their history.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    done(await deleteUser({ id: user.id }));
  }

  // Protecting the last owner is enforced on the server too; this just avoids
  // offering an action that is going to be refused.
  const lockedByOwnerRule = isLastActiveOwner;

  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface-raised p-4",
        !user.isActive && "opacity-70",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {user.name}
            {isSelf && <Badge tone="brand">You</Badge>}
            {!user.isActive && <Badge tone="danger">Deactivated</Badge>}
            {!user.hasPassword && (
              <Badge tone="warning" title="No password set — they cannot sign in">
                No password
              </Badge>
            )}
          </p>
          <p className="truncate text-sm text-foreground-muted">{user.email}</p>
          <p className="mt-0.5 text-xs text-foreground-subtle">
            {user.phone ? `${user.phone} · ` : ""}
            {user.lastLoginAt
              ? `Last signed in ${new Date(user.lastLoginAt).toLocaleDateString("en-GB")}`
              : "Never signed in"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canChangeRole && !isSelf ? (
            <label className="text-sm">
              <span className="sr-only">Role for {user.name}</span>
              <select
                value={user.role}
                onChange={(e) => onRoleChange(e.target.value)}
                disabled={busy || lockedByOwnerRule}
                title={
                  lockedByOwnerRule
                    ? "This is the only active owner — make someone else an owner first"
                    : undefined
                }
                className="h-10 rounded-lg border border-border bg-surface-raised px-2 pr-7 text-sm disabled:opacity-60"
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
                <option value="CUSTOMER">{ROLE_LABELS.CUSTOMER}</option>
              </select>
            </label>
          ) : (
            <Badge tone="neutral">{ROLE_LABELS[user.role]}</Badge>
          )}

          {canUpdate && (
            <>
              <button
                type="button"
                onClick={onResetPassword}
                disabled={busy}
                title="Set a new password"
                className="grid size-10 place-items-center rounded-lg border border-border text-foreground-muted hover:bg-surface hover:text-foreground"
              >
                <KeyRound className="size-4" aria-hidden />
                <span className="sr-only">Set a new password for {user.name}</span>
              </button>

              {!isSelf && (
                <button
                  type="button"
                  onClick={onToggleActive}
                  disabled={busy || (user.isActive && lockedByOwnerRule)}
                  title={user.isActive ? "Deactivate" : "Reactivate"}
                  className="grid size-10 place-items-center rounded-lg border border-border text-foreground-muted hover:bg-surface hover:text-foreground disabled:opacity-50"
                >
                  {user.isActive ? (
                    <UserX className="size-4" aria-hidden />
                  ) : (
                    <UserCheck className="size-4" aria-hidden />
                  )}
                  <span className="sr-only">
                    {user.isActive ? "Deactivate" : "Reactivate"} {user.name}
                  </span>
                </button>
              )}
            </>
          )}

          {canDelete && !isSelf && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy || lockedByOwnerRule}
              title="Delete permanently"
              className="grid size-10 place-items-center rounded-lg border border-border text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">Delete {user.name}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
