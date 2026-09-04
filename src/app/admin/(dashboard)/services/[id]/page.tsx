import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

import { ServiceForm, type ServiceFormValues } from "../service-form";

export const metadata: Metadata = { title: "Edit service" };

function decimalToInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default async function EditServicePage({
  params,
}: PageProps<"/admin/services/[id]">) {
  await requirePermission("service:manage");
  const { id } = await params;

  const [service, categories] = await Promise.all([
    db.service.findUnique({
      where: { id },
      include: { prices: true, _count: { select: { bookingServices: true } } },
    }),
    db.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!service) notFound();

  const prices: ServiceFormValues["prices"] = {};
  for (const row of service.prices) {
    prices[row.vehicleClass] = {
      price: decimalToInput(row.price),
      durationMinutes: row.durationMinutes?.toString() ?? "",
    };
  }

  const values: ServiceFormValues = {
    id: service.id,
    name: service.name,
    categoryId: service.categoryId ?? "",
    shortDescription: service.shortDescription ?? "",
    description: service.description ?? "",
    basePrice: decimalToInput(service.basePrice),
    priceFrom: service.priceFrom,
    durationMinutes: service.durationMinutes?.toString() ?? "",
    isActive: service.isActive,
    isFeatured: service.isFeatured,
    sortOrder: String(service.sortOrder),
    seoTitle: service.seoTitle ?? "",
    seoDescription: service.seoDescription ?? "",
    prices,
  };

  return (
    <div>
      <Link
        href="/admin/services"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All services
      </Link>

      <PageHeader
        title={service.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={service.isActive ? "success" : "neutral"}>
              {service.isActive ? "Active" : "Hidden"}
            </Badge>
            <Badge tone="info">
              {service.prices.length} vehicle price
              {service.prices.length === 1 ? "" : "s"}
            </Badge>
            {service.wooId && (
              <Badge tone="info" title="Folded out of the old WooCommerce products">
                Imported #{service.wooId}
              </Badge>
            )}
          </span>
        }
      />

      <ServiceForm
        values={values}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        canDelete={service._count.bookingServices === 0}
      />
    </div>
  );
}
