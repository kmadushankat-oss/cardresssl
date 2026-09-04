import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

import { ServiceForm, type ServiceFormValues } from "../service-form";

export const metadata: Metadata = { title: "New service" };

const BLANK: ServiceFormValues = {
  name: "",
  categoryId: "",
  shortDescription: "",
  description: "",
  basePrice: "",
  priceFrom: true,
  durationMinutes: "",
  isActive: true,
  isFeatured: false,
  sortOrder: "0",
  seoTitle: "",
  seoDescription: "",
  prices: {},
};

export default async function NewServicePage() {
  await requirePermission("service:manage");

  const categories = await db.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

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
        title="New service"
        description="Set a price for each vehicle size you offer it for, or a single base price."
      />

      <ServiceForm
        values={BLANK}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        canDelete={false}
      />
    </div>
  );
}
