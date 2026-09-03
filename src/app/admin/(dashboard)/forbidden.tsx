import { Lock } from "lucide-react";
import Link from "next/link";

/**
 * Rendered when `requirePermission()` calls `forbidden()` — the visitor is
 * signed in as staff but this area is not theirs.
 */
export default function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-surface">
        <Lock className="size-5 text-foreground-muted" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">You don&rsquo;t have access to this</h1>
      <p className="mt-2 text-foreground-muted">
        Your role doesn&rsquo;t include this area. If you think it should, ask the
        owner to update your permissions.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface-raised px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
