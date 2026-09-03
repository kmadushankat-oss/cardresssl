import { headers } from "next/headers";
import { forbidden, redirect, unauthorized } from "next/navigation";
import { cache } from "react";

import type { UserRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { can, canAny, isStaffRole, type Permission } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  isActive: boolean;
};

/**
 * The signed-in user, or null. Wrapped in `cache()` so a single request that
 * checks permissions in the layout, the page and three server actions still
 * only resolves the session once.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const u = session.user as typeof session.user & {
    role?: string | null;
    isActive?: boolean | null;
  };

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: (u.role ?? "CUSTOMER") as UserRole,
    isActive: u.isActive ?? true,
  };
});

/** Any signed-in, non-disabled user. Redirects to sign-in otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/sign-in");
  if (!user.isActive) redirect("/admin/sign-in?error=account-disabled");
  return user;
}

/** A user who may enter the admin dashboard at all. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaffRole(user.role)) redirect("/");
  return user;
}

/**
 * Gate a page or server action on a specific permission.
 * Renders the nearest `forbidden.tsx` rather than silently showing empty data.
 */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireStaff();
  if (!can(user.role, permission)) forbidden();
  return user;
}

/** Gate on holding at least one of several permissions. */
export async function requireAnyPermission(
  permissions: readonly Permission[],
): Promise<SessionUser> {
  const user = await requireStaff();
  if (!canAny(user.role, permissions)) forbidden();
  return user;
}

/**
 * Permission check for API route handlers, which want a 401/403 response
 * rather than a redirect.
 */
export async function authorizeRequest(
  permission: Permission,
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !user.isActive) unauthorized();
  if (!isStaffRole(user.role) || !can(user.role, permission)) forbidden();
  return user;
}
