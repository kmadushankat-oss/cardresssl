"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Animates a headline in, one word at a time.
 *
 * Word by word rather than letter by letter, deliberately. Splitting into
 * individual characters means a screen reader announces the heading one letter
 * at a time — "Y, o, u, r" — which is genuinely unpleasant, and it also breaks
 * text selection and search-in-page. Word granularity looks nearly identical
 * and keeps the heading a heading.
 *
 * The whole string stays in the DOM as one accessible label, so what is
 * announced is the sentence, not a list of fragments.
 */
export function AnimatedHeadline({
  text,
  /** Words from this index onward get the brand gradient. */
  highlightFrom,
  className,
  /** Seconds between each word. */
  stagger = 0.08,
  /** Seconds before the first word. */
  delay = 0.1,
  as: Tag = "h1",
}: {
  text: string;
  highlightFrom?: number;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: "h1" | "h2";
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setAnimate(true);
  }, []);

  const words = text.split(" ");

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, index) => {
        const highlighted = highlightFrom !== undefined && index >= highlightFrom;

        return (
          <span
            key={`${word}-${index}`}
            // The label above carries the full sentence; these are visual.
            aria-hidden
            className={cn(
              "inline-block",
              animate && "word-in",
              highlighted && "text-gradient",
            )}
            style={
              animate
                ? { animationDelay: `${delay + index * stagger}s` }
                : undefined
            }
          >
            {word}
            {/* A real space, so words do not run together when wrapped. */}
            {index < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </Tag>
  );
}

/** Wraps arbitrary children with the same one-shot entrance. */
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setAnimate(true);
  }, []);

  return (
    <div
      className={cn(animate && "word-in", className)}
      style={animate ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
