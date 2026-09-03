/**
 * Role-based access control.
 *
 * A single source of truth for "who may do what". Every server action, API
 * route and admin page checks against these permissions rather than testing
 * `role === "ADMIN"` inline — so changing what a MANAGER can do is a one-line
 * edit here instead of a hunt through the codebase.
 */

import type { UserRole } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  // Dashboard
  "dashboard:view",
  "reports:view",
  "reports:financial",

  // Catalogue
  "product:view",
  "product:create",
  "product:update",
  "product:delete",
  "product:viewCost", // seeing what we paid is not for everyone
  "category:manage",
  "brand:manage",

  // Inventory
  "inventory:view",
  "inventory:adjust",
  "supplier:manage",

  // Services
  "service:view",
  "service:manage",

  // Bookings
  "booking:view",
  "booking:create",
  "booking:update",
  "booking:delete",
  "booking:assign",

  // Job cards
  "jobcard:view",
  "jobcard:viewAssigned", // mechanics: only their own
  "jobcard:create",
  "jobcard:update",
  "jobcard:delete",
  "jobcard:assign",

  // Customers & vehicles
  "customer:view",
  "customer:create",
  "customer:update",
  "customer:delete",

  // Orders
  "order:view",
  "order:create",
  "order:update",
  "order:delete",

  // Invoicing
  "invoice:view",
  "invoice:create",
  "invoice:update",
  "invoice:delete",
  "invoice:send",
  "payment:view",
  "payment:record",
  "payment:delete",

  // Content
  "content:view",
  "content:manage",
  "media:view",
  "media:upload",
  "media:delete",
  "enquiry:view",
  "enquiry:manage",

  // Administration
  "user:view",
  "user:create",
  "user:update",
  "user:delete",
  "user:changeRole",
  "settings:view",
  "settings:manage",
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Everything in PERMISSIONS — used by OWNER and as a base for ADMIN. */
const ALL: readonly Permission[] = PERMISSIONS;

const ADMIN: readonly Permission[] = ALL.filter(
  // Only the owner may hand out roles or wipe financial records.
  (p) => !(["user:delete", "payment:delete", "user:changeRole"] as string[]).includes(p),
);

const MANAGER: readonly Permission[] = [
  "dashboard:view",
  "reports:view",
  "reports:financial",
  "product:view",
  "product:create",
  "product:update",
  "product:delete",
  "product:viewCost",
  "category:manage",
  "brand:manage",
  "inventory:view",
  "inventory:adjust",
  "supplier:manage",
  "service:view",
  "service:manage",
  "booking:view",
  "booking:create",
  "booking:update",
  "booking:delete",
  "booking:assign",
  "jobcard:view",
  "jobcard:create",
  "jobcard:update",
  "jobcard:assign",
  "customer:view",
  "customer:create",
  "customer:update",
  "order:view",
  "order:create",
  "order:update",
  "invoice:view",
  "invoice:create",
  "invoice:update",
  "invoice:send",
  "payment:view",
  "payment:record",
  "content:view",
  "content:manage",
  "media:view",
  "media:upload",
  "media:delete",
  "enquiry:view",
  "enquiry:manage",
  "user:view",
  "settings:view",
];

const ACCOUNTANT: readonly Permission[] = [
  "dashboard:view",
  "reports:view",
  "reports:financial",
  "product:view",
  "product:viewCost",
  "inventory:view",
  "customer:view",
  "customer:update",
  "order:view",
  "order:update",
  "invoice:view",
  "invoice:create",
  "invoice:update",
  "invoice:send",
  "payment:view",
  "payment:record",
  "jobcard:view",
  "settings:view",
];

const SERVICE_ADVISOR: readonly Permission[] = [
  "dashboard:view",
  "product:view",
  "inventory:view",
  "service:view",
  "booking:view",
  "booking:create",
  "booking:update",
  "booking:assign",
  "jobcard:view",
  "jobcard:create",
  "jobcard:update",
  "jobcard:assign",
  "customer:view",
  "customer:create",
  "customer:update",
  "order:view",
  "order:create",
  "order:update",
  "invoice:view",
  "invoice:create",
  "invoice:send",
  "payment:view",
  "payment:record",
  "enquiry:view",
  "enquiry:manage",
  "media:view",
  "media:upload",
];

const MECHANIC: readonly Permission[] = [
  "dashboard:view",
  "jobcard:viewAssigned",
  "jobcard:update",
  "product:view",
  "inventory:view",
  "customer:view",
  "media:view",
  "media:upload",
];

const STOREKEEPER: readonly Permission[] = [
  "dashboard:view",
  "product:view",
  "product:create",
  "product:update",
  "product:viewCost",
  "category:manage",
  "brand:manage",
  "inventory:view",
  "inventory:adjust",
  "supplier:manage",
  "order:view",
  "order:update",
  "media:view",
  "media:upload",
];

/** CUSTOMER accounts have no admin dashboard access at all. */
const CUSTOMER: readonly Permission[] = [];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN,
  MANAGER,
  ACCOUNTANT,
  SERVICE_ADVISOR,
  MECHANIC,
  STOREKEEPER,
  CUSTOMER,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  SERVICE_ADVISOR: "Service Advisor",
  MECHANIC: "Mechanic",
  STOREKEEPER: "Storekeeper",
  CUSTOMER: "Customer",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  OWNER: "Unrestricted access, including staff roles and deleting financial records.",
  ADMIN: "Runs the whole system day to day, but cannot change roles or delete payments.",
  MANAGER: "Catalogue, stock, bookings, job cards, invoices and reports.",
  ACCOUNTANT: "Invoices, payments and financial reports. Read-only on the catalogue.",
  SERVICE_ADVISOR: "Front desk: bookings, job cards, customers, vehicles and billing.",
  MECHANIC: "Only the job cards assigned to them.",
  STOREKEEPER: "Spare parts catalogue, stock levels and suppliers.",
  CUSTOMER: "Website account. No access to the admin dashboard.",
};

/** Roles that may sign in to /admin at all. */
export const STAFF_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "SERVICE_ADVISOR",
  "MECHANIC",
  "STOREKEEPER",
] as const satisfies readonly UserRole[];

export function isStaffRole(role: UserRole): boolean {
  return (STAFF_ROLES as readonly UserRole[]).includes(role);
}

/** Does this role hold the given permission? */
export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Does this role hold *every* listed permission? */
export function canAll(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/** Does this role hold *at least one* of the listed permissions? */
export function canAny(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/**
 * True if the actor may see job cards they are not assigned to. Mechanics get
 * `jobcard:viewAssigned` instead of `jobcard:view`, so list queries must scope
 * to their own rows.
 */
export function canViewAllJobCards(role: UserRole): boolean {
  return can(role, "jobcard:view");
}
