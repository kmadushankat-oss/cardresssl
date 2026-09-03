import { cn } from "@/lib/utils";

/**
 * The Car Dress SL lockup.
 *
 * PLACEHOLDER — a text lockup stands in until the real logo artwork arrives.
 * When it does, drop the files into `public/brand/` and replace the markup in
 * this one component; every header, sidebar and email that shows the logo goes
 * through here, so nothing else needs touching.
 *
 * Ask for two variants: a full-colour version for light backgrounds, and a
 * knockout (all-white) version for dark ones. SVG preferred.
 */
export function Wordmark({
  className,
  tone = "auto",
}: {
  className?: string;
  /** `light` forces white text for use on a dark background. */
  tone?: "auto" | "light";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 font-display leading-none",
        className,
      )}
    >
      <span
        className={cn(
          "text-lg font-bold tracking-tight",
          tone === "light" ? "text-white" : "text-foreground",
        )}
      >
        CAR
      </span>
      <span className="text-lg font-bold tracking-tight text-primary">DRESS</span>
      <span
        className={cn(
          "text-[0.6rem] font-semibold tracking-[0.18em]",
          tone === "light" ? "text-white/60" : "text-foreground-muted",
        )}
      >
        SL
      </span>
    </span>
  );
}

/** The strapline from the logo, for footers and hero sections. */
export function Strapline({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-foreground-muted",
        className,
      )}
    >
      Wash · Detail · Quickfit
    </span>
  );
}
