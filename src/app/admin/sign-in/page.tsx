import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/wordmark";

import { getSessionUser } from "@/lib/session";
import { isStaffRole } from "@/lib/permissions";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  "account-disabled":
    "This account has been deactivated. Ask the owner to re-enable it.",
  forbidden: "Your account does not have access to that area.",
};

export default async function SignInPage({ searchParams }: PageProps<"/admin/sign-in">) {
  const params = await searchParams;

  const rawNext = typeof params.next === "string" ? params.next : "/admin";
  // Only ever redirect within this site — an open redirect here would be a
  // ready-made phishing tool.
  const redirectTo = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/admin";

  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined;

  // Already signed in as staff? Skip the form.
  const user = await getSessionUser();
  if (user?.isActive && isStaffRole(user.role)) redirect(redirectTo);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      {/*
        Decorative backdrop. Two brand washes over a hairline grid, with the
        glow drifting slowly — enough to make the screen feel alive without
        distracting from a form someone uses twenty times a day.
      */}
      <div className="pointer-events-none absolute inset-0 grid-texture opacity-60" aria-hidden />
      <div className="pointer-events-none absolute inset-0 hero-glow drift" aria-hidden />
      {/* Vignette, so the card sits clearly above the texture. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,transparent,--theme(--color-ink-950)_85%)]"
        aria-hidden
      />

      <div className="rise-in relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark tone="light" className="scale-125" />
        </div>

        <div className="rounded-card border border-ink-800/80 bg-ink-900/70 p-6 shadow-lifted backdrop-blur-xl">
          <h1 className="text-xl font-semibold text-white">Staff sign in</h1>
          <p className="mt-1 mb-6 text-sm text-ink-300">
            Manage parts, services, bookings and enquiries.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* The form renders on the dark card, so it opts into dark tokens. */}
          <div className="dark">
            <SignInForm redirectTo={redirectTo} />
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink-400">
          Not staff?{" "}
          <a href="/" className="text-brand-300 underline-offset-4 hover:underline">
            Back to the website
          </a>
        </p>
      </div>
    </main>
  );
}
