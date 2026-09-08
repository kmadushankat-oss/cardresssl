"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Reveals its children once, the first time they scroll into view.
 *
 * Deliberately not the CSS `animation-timeline: view()` used elsewhere. A
 * scroll-driven animation ties opacity to scroll *position*, so scrolling back
 * up fades the content out again — content that flickers as you move around a
 * page is worse than content that simply arrives. An IntersectionObserver fires
 * once and then stops observing, which is what "reveal on first scroll"
 * actually means.
 *
 * Anyone with reduced motion enabled gets the content immediately, with no
 * observer attached at all.
 */
export function Reveal({
  children,
  className,
  /** Seconds to wait after the element enters view. For deliberate sequencing. */
  delay = 0,
  /** How much of the element must be visible before it triggers. */
  threshold = 0.12,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
  as?: "div" | "section" | "li" | "ul";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect the OS setting: show it and attach nothing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    // Already on screen at mount (above the fold) — reveal without waiting for
    // a scroll that may never come.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          // Once is once: stop watching so it never plays again.
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref as never}
      data-shown={shown ? "true" : "false"}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      className={cn("reveal-on-view", className)}
    >
      {children}
    </Tag>
  );
}

/**
 * Reveals its children in sequence.
 *
 * The whole group is observed as one, then each child is offset by
 * `stagger` seconds — so a row of cards arrives left to right rather than all
 * at once, and the timing does not depend on where each individual card sits.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  as?: "div" | "ul" | "section";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      data-shown={shown ? "true" : "false"}
      // Consumed by the CSS below to offset each child in turn.
      style={{ "--stagger": `${stagger}s` } as React.CSSProperties}
      className={cn("reveal-group", className)}
    >
      {children}
    </Tag>
  );
}
