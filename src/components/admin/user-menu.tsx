"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/lib/auth-client";

export function UserMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/admin/sign-in");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="px-2">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="truncate text-xs text-ink-400">{email}</p>
        <p className="mt-1.5 inline-block rounded bg-brand-500/15 px-1.5 py-0.5 text-[11px] font-medium text-brand-300">
          {roleLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-ink-200 transition-colors hover:bg-ink-800 hover:text-white disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
