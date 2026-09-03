import type { UserRole } from "@/generated/prisma/enums";
import { canAny, type Permission } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  /** Lucide icon name, resolved in the sidebar component. */
  icon: string;
  /** Shown if the user holds *any* of these. */
  permissions: readonly Permission[];
  /** Marks features that exist in the schema but ship in phase 2. */
  comingSoon?: boolean;
};

export type NavSection = {
  title: string;
  items: readonly NavItem[];
};

/**
 * The admin sidebar, described as data.
 *
 * Each entry carries the permissions that justify it, so the nav a user sees
 * always matches what they can actually open — no dead links, and no need to
 * keep a separate list in sync with the route guards.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: "layout-dashboard",
        permissions: ["dashboard:view"],
      },
    ],
  },
  {
    title: "Catalogue",
    items: [
      {
        label: "Products",
        href: "/admin/products",
        icon: "package",
        permissions: ["product:view"],
      },
      {
        label: "Needs review",
        href: "/admin/products/review",
        icon: "clipboard-check",
        permissions: ["product:update"],
      },
      {
        label: "Categories",
        href: "/admin/categories",
        icon: "folder-tree",
        permissions: ["category:manage"],
      },
      {
        label: "Brands",
        href: "/admin/brands",
        icon: "tag",
        permissions: ["brand:manage"],
      },
      {
        label: "Stock",
        href: "/admin/stock",
        icon: "boxes",
        permissions: ["inventory:view"],
      },
    ],
  },
  {
    title: "Workshop",
    items: [
      {
        label: "Services",
        href: "/admin/services",
        icon: "wrench",
        permissions: ["service:view"],
      },
      {
        label: "Bookings",
        href: "/admin/bookings",
        icon: "calendar-check",
        permissions: ["booking:view"],
      },
      {
        label: "Job cards",
        href: "/admin/job-cards",
        icon: "clipboard-list",
        permissions: ["jobcard:view", "jobcard:viewAssigned"],
        comingSoon: true,
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        label: "Order enquiries",
        href: "/admin/orders",
        icon: "shopping-cart",
        permissions: ["order:view"],
      },
      {
        label: "Customers",
        href: "/admin/customers",
        icon: "users",
        permissions: ["customer:view"],
      },
      {
        label: "Invoices",
        href: "/admin/invoices",
        icon: "receipt",
        permissions: ["invoice:view"],
        comingSoon: true,
      },
    ],
  },
  {
    title: "Website",
    items: [
      {
        label: "Enquiries",
        href: "/admin/enquiries",
        icon: "inbox",
        permissions: ["enquiry:view"],
      },
      {
        label: "Media",
        href: "/admin/media",
        icon: "image",
        permissions: ["media:view"],
      },
      {
        label: "Pages & content",
        href: "/admin/content",
        icon: "file-text",
        permissions: ["content:view"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Staff & roles",
        href: "/admin/users",
        icon: "shield-check",
        permissions: ["user:view"],
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        permissions: ["settings:view"],
      },
      {
        label: "Redirects",
        href: "/admin/redirects",
        icon: "signpost",
        permissions: ["settings:manage"],
      },
      {
        label: "Audit log",
        href: "/admin/audit",
        icon: "history",
        permissions: ["audit:view"],
      },
    ],
  },
];

/** The sections and items this role may actually reach, empties removed. */
export function navForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter((item) => canAny(role, item.permissions)),
  })).filter((section) => section.items.length > 0);
}
