import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface text-foreground-muted border-border",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  danger: "bg-danger/10 text-danger border-danger/25",
  info: "bg-ink-500/10 text-foreground-muted border-ink-500/25",
  brand: "bg-primary/12 text-primary-text border-primary/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
