"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markProductReviewed } from "../actions";

/**
 * Clears the review flag in place.
 *
 * The queue is 701 items long, so being able to dismiss the ones that are
 * genuinely fine — without opening and saving each form — is the difference
 * between a workable list and an abandoned one.
 */
export function MarkReviewedButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setSaving(true);
    setError(null);
    const result = await markProductReviewed({ id });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={saving || pending}
        aria-label={`Mark ${name} as reviewed`}
        title="Mark as reviewed"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        <Check className="size-4" aria-hidden />
        <span className="hidden sm:inline">{saving ? "Saving…" : "Done"}</span>
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </>
  );
}
