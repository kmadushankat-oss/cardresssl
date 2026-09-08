"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY } from "@/components/theme-script";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Apply a choice to the document and remember it. */
function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);

  document.documentElement.classList.toggle("dark", dark);

  try {
    // "system" is stored as the *absence* of a preference, which is what
    // ThemeScript already checks for — so the two agree with no extra logic.
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode or blocked storage: the choice applies for this page only. */
  }
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* Unreadable storage behaves as "no preference". */
  }
  return "system";
}

/**
 * Light / Dark / System switch.
 *
 * Three states rather than two on purpose: "system" is the one most people
 * actually want, and a plain on/off toggle silently opts them out of their
 * phone's own evening switch to dark.
 *
 * The current value can only be known on the client, so the control renders in
 * a neutral state until mounted. Without that, the server would have to guess
 * and the markup would mismatch on hydration.
 */
export function ThemeToggle({
  className,
  variant = "segmented",
}: {
  className?: string;
  /** `segmented` shows all three; `icon` cycles through them in one button. */
  variant?: "segmented" | "icon";
}) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setMounted(true);
  }, []);

  /*
   * While on "system", follow the OS live. Someone whose phone flips to dark at
   * sunset expects the page in front of them to flip too, not on next reload.
   */
  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  if (variant === "icon") {
    const order: Theme[] = ["light", "dark", "system"];
    const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
    const Icon = current.icon;
    const next = order[(order.indexOf(theme) + 1) % order.length];

    return (
      <button
        type="button"
        onClick={() => choose(next)}
        // Until mounted the label would be a guess, so keep it generic.
        aria-label={mounted ? `Theme: ${current.label}. Switch to ${next}.` : "Change theme"}
        title={mounted ? `Theme: ${current.label}` : "Change theme"}
        className={cn(
          "press grid size-10 place-items-center rounded-lg text-foreground-muted",
          "transition-colors hover:bg-surface hover:text-foreground",
          className,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = mounted && theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option.value)}
            title={option.label}
            className={cn(
              "press inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              active
                ? "bg-surface-raised text-foreground shadow-sm"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
