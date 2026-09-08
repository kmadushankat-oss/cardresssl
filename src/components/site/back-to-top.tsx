"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Jump back to the top of the page.
 *
 * Earns its place here: the parts catalogue runs to 24 cards a page and the
 * services list to 112 entries, so the header — which holds the search and the
 * phone number — can be a very long way up.
 *
 * Sits above the fixed mobile call bar rather than over it, and only appears
 * once there is enough page behind you to be worth going back for.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      /*
       * Roughly a screen and a half — far enough that scrolling back is a
       * chore. The floor matters: `innerHeight` can legitimately read 0 before
       * layout settles, or inside an embedded/offscreen frame, and without it
       * the threshold collapses to zero and the button appears at the very top
       * of the page where it has nothing to do.
       */
      const threshold = Math.max(600, window.innerHeight * 1.2);
      setVisible(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toTop() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });

    /*
     * Move focus to the main landmark as well as scrolling. A keyboard user who
     * presses this and then Tab should continue from the top of the page, not
     * from whatever was focused halfway down it.
     */
    const main = document.getElementById("main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
      main.removeAttribute("tabindex");
    }
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      // Hidden from the tab order while off screen, so it is never a focus trap
      // for something the user cannot see.
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "fixed right-4 z-30 grid size-11 place-items-center rounded-full",
        "border border-border bg-surface-raised/90 text-foreground shadow-lifted backdrop-blur",
        "transition-all duration-300 hover:border-primary/60 hover:text-primary-text",
        // Clear of the mobile call bar; back to the corner on larger screens.
        "bottom-20 lg:bottom-6",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="size-5" aria-hidden />
    </button>
  );
}
