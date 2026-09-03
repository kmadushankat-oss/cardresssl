import {
  AlertTriangle,
  CalendarCheck,
  ClipboardCheck,
  Inbox,
  Package,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requirePermission("dashboard:view");

  // Mechanics see only their own work; everyone else sees the shop.
  const seesEverything = can(user.role, "booking:view");

  const [
    productCount,
    activeProducts,
    needsReview,
    lowStock,
    serviceCount,
    pendingBookings,
    newEnquiries,
  ] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.product.count({ where: { needsReview: true } }),
    db.product.count({
      where: { trackInventory: true, isActive: true, stockQty: { lte: 5 } },
    }),
    db.service.count({ where: { isActive: true } }),
    seesEverything
      ? db.booking.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    can(user.role, "enquiry:view")
      ? db.enquiry.count({ where: { status: "NEW" } })
      : Promise.resolve(0),
  ]);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Good day, {firstName}</h1>
        <p className="mt-1 text-foreground-muted">
          Here is where things stand right now.
        </p>
      </header>

      {productCount === 0 && (
        <SetupNotice />
      )}

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Key numbers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {can(user.role, "product:view") && (
            <Stat
              icon={Package}
              label="Products"
              value={productCount}
              detail={`${activeProducts} active`}
              href="/admin/products"
            />
          )}
          {can(user.role, "product:update") && needsReview > 0 && (
            <Stat
              icon={ClipboardCheck}
              label="Needs review"
              value={needsReview}
              detail="Imported items to check"
              href="/admin/products/review"
              tone="warning"
            />
          )}
          {can(user.role, "inventory:view") && (
            <Stat
              icon={AlertTriangle}
              label="Low stock"
              value={lowStock}
              detail="At or below threshold"
              href="/admin/stock"
              tone={lowStock > 0 ? "warning" : "default"}
            />
          )}
          {can(user.role, "service:view") && (
            <Stat
              icon={Wrench}
              label="Services"
              value={serviceCount}
              detail="Live on the website"
              href="/admin/services"
            />
          )}
          {seesEverything && (
            <Stat
              icon={CalendarCheck}
              label="Pending bookings"
              value={pendingBookings}
              detail="Awaiting confirmation"
              href="/admin/bookings"
              tone={pendingBookings > 0 ? "accent" : "default"}
            />
          )}
          {can(user.role, "enquiry:view") && (
            <Stat
              icon={Inbox}
              label="New enquiries"
              value={newEnquiries}
              detail="Not yet answered"
              href="/admin/enquiries"
              tone={newEnquiries > 0 ? "accent" : "default"}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-card border border-brand-600/30 bg-brand-50 p-5 dark:bg-brand-950/40">
      <h2 className="font-display font-semibold">No products yet</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        The catalogue is empty. Import the existing WooCommerce products with{" "}
        <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs">
          npm run import:woo
        </code>
        , or add a product by hand.
      </p>
    </div>
  );
}

type StatTone = "default" | "accent" | "warning";

const TONES: Record<StatTone, string> = {
  default: "text-foreground-muted",
  accent: "text-primary",
  warning: "text-warning",
};

function Stat({
  icon: IconCmp,
  label,
  value,
  detail,
  href,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  detail: string;
  href: string;
  tone?: StatTone;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-card border border-border bg-surface-raised p-5",
        "shadow-card transition-shadow hover:shadow-lifted",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-foreground-muted">{label}</span>
        <IconCmp className={cn("size-5 shrink-0", TONES[tone])} />
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
        {value.toLocaleString("en-LK")}
      </p>
      <p className="mt-1 text-sm text-foreground-subtle">{detail}</p>
    </Link>
  );
}
