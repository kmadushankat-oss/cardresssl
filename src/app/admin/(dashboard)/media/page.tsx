import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

import { MediaLibrary } from "./media-library";

export const metadata: Metadata = { title: "Media" };

const PAGE_SIZE = 36;

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const user = await requirePermission("media:view");
  const params = await searchParams;

  const folder = typeof params.folder === "string" ? params.folder : undefined;
  const page = Math.max(
    1,
    Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1,
  );

  const where = folder ? { folder } : {};

  const [items, total, folders] = await Promise.all([
    db.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { uploadedBy: { select: { name: true } } },
    }),
    db.media.count({ where }),
    db.media.groupBy({ by: ["folder"], _count: true, orderBy: { folder: "asc" } }),
  ]);

  const totalBytes = await db.media.aggregate({ _sum: { sizeBytes: true } });
  const megabytes = ((totalBytes._sum.sizeBytes ?? 0) / 1_048_576).toFixed(1);

  const buildHref = (nextPage: number) => {
    const qs = new URLSearchParams();
    if (folder) qs.set("folder", folder);
    if (nextPage > 1) qs.set("page", String(nextPage));
    const s = qs.toString();
    return s ? `/admin/media?${s}` : "/admin/media";
  };

  return (
    <div>
      <PageHeader
        title="Media"
        description={`${total} file${total === 1 ? "" : "s"} · ${megabytes} MB total`}
      />

      <MediaLibrary
        items={items.map((m) => ({
          id: m.id,
          url: m.url,
          filename: m.filename,
          originalName: m.originalName,
          alt: m.alt,
          width: m.width,
          height: m.height,
          sizeBytes: m.sizeBytes,
          folder: m.folder,
          uploadedBy: m.uploadedBy?.name ?? null,
          createdAt: m.createdAt.toISOString(),
        }))}
        folders={folders.map((f) => ({ name: f.folder, count: f._count }))}
        activeFolder={folder ?? null}
        canUpload={can(user.role, "media:upload")}
        canDelete={can(user.role, "media:delete")}
      />

      <div className="mt-4">
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          total={total}
          pageSize={PAGE_SIZE}
          buildHref={buildHref}
        />
      </div>
    </div>
  );
}
