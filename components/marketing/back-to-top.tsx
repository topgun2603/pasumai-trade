"use client";

import { ArrowUpIcon } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Back to the top of a very long page.
 *
 * The landing page runs to about eight screens on a phone — hero, prices,
 * bargaining, how it works, farmers, buyers, trust, drivers, coverage, FAQ,
 * enquiry, footer. Somebody who has read to the coverage map and decided to
 * register has to swipe past all of it to reach the header, and the one control
 * that would take them there is the browser's, which on Android is not obvious
 * and on iOS is a tap on the clock.
 *
 * ## Why `useSyncExternalStore` rather than an effect
 *
 * The obvious version subscribes to `scroll` in an effect and calls `setState`,
 * which this codebase's lint rules reject — and rightly: it tears on the first
 * paint, because the initial state is a guess made before the scroll position
 * is known. This subscribes to the browser's own value and reads it, so the
 * server renders `false`, the client reads the truth, and there is no moment
 * where the two disagree.
 *
 * ## Why it unmounts rather than fades
 *
 * Hidden with opacity it would still be in the tab order — a keyboard user
 * would tab from the footer into a button they cannot see, which is the same
 * trap as a focusable element inside `aria-hidden`. Returning null costs an
 * animation and buys a control that only exists when it does something.
 */

/** Roughly a screen and a half: far enough that the header is genuinely gone. */
const THRESHOLD = 900;

function subscribe(onChange: () => void) {
  // Passive: this listener never calls preventDefault, and saying so keeps it
  // off the scrolling critical path on a budget phone.
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange, { passive: true });
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function BackToTop({ label }: { label: string }) {
  const scrolled = useSyncExternalStore(
    subscribe,
    () => window.scrollY > THRESHOLD,
    // The server has no scroll position, and guessing `true` would render a
    // button that flickers away on hydration.
    () => false,
  );

  const toTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      // Honouring the system setting: a page flying past eight screens is
      // exactly the motion somebody turns that off to avoid.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);

  if (!scrolled) return null;

  return (
    <button
      type="button"
      onClick={toTop}
      // Named for a screen reader, and titled for a pointer — the icon alone
      // is an arrow, which could mean half a dozen things.
      aria-label={label}
      title={label}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring fixed right-4 bottom-4 z-40 flex size-11 items-center justify-center rounded-full shadow-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:right-6 sm:bottom-6"
    >
      <ArrowUpIcon className="size-5" />
    </button>
  );
}
