"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts from zero up to `value` when the page loads.
 *
 * The real figure is rendered server-side and stays on screen until the
 * animation has actually begun, so it is what search engines see and what
 * anyone without JavaScript reads — the count is decoration, never the source
 * of truth.
 *
 * That ordering matters more than it looks. `requestAnimationFrame` does not
 * fire in a background tab, and an earlier version zeroed the display *before*
 * requesting a frame — so opening the site in a background tab (middle-click a
 * link, come back later) left "0 spare parts listed" on screen indefinitely.
 * Now the display is only handed over once a frame has genuinely arrived, and a
 * timeout backstop restores the true figure if frames never come at all.
 */
export function CountUp({
  value,
  duration = 1400,
  className,
}: {
  value: number;
  /** Milliseconds for the whole run. */
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [animating, setAnimating] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Nothing worth animating for one or two items.
    if (value <= 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let startedAt: number | null = null;

    // Ease-out cubic: quick off the mark, settles gently on the final figure.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      if (cancelled) return;

      // First real frame: only now is it safe to take over the display.
      if (startedAt === null) {
        startedAt = now;
        setAnimating(true);
      }

      const progress = Math.min(1, (now - startedAt) / duration);
      setDisplay(Math.round(ease(progress) * value));

      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        setAnimating(false);
      }
    };

    frame.current = requestAnimationFrame(step);

    /*
     * Backstop. If no frame has arrived by the time the run should have
     * finished, the tab is throttled or hidden — abandon the animation and show
     * the true number. A wrong figure on screen is far worse than no animation.
     */
    const backstop = window.setTimeout(() => {
      if (startedAt !== null) return;
      cancelled = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      setDisplay(value);
      setAnimating(false);
    }, duration + 600);

    return () => {
      cancelled = true;
      window.clearTimeout(backstop);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {/*
        While counting, the ticking figure is hidden from assistive tech and the
        true value exposed alongside it: a screen reader announcing
        "4… 37… 128… 291… 441" is noise, not information.
      */}
      <span aria-hidden={animating ? "true" : undefined}>
        {display.toLocaleString("en-LK")}
      </span>
      {animating && <span className="sr-only">{value.toLocaleString("en-LK")}</span>}
    </span>
  );
}
