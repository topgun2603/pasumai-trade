"use client";

import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import type { Tour } from "@/lib/domain/tour";
import { cn } from "@/lib/utils";

/**
 * The first-run tour, drawn over the console it is describing.
 *
 * ## Measuring without an effect
 *
 * A coach mark has to know where its target is, and the obvious build — measure
 * in an effect, put the rect in state — is the exact thing this codebase bans
 * (`react-hooks/set-state-in-effect`), for the usual reason: it renders once
 * against nothing, then again against a measurement, and every layout shift
 * repeats the pair.
 *
 * So the DOM is read as what it actually is: an external mutable store.
 * `getSnapshot` returns the rects as a *string*, which React can compare by
 * value — so a scroll that moves nothing re-measures and re-renders nothing.
 * The server snapshot is empty, which renders no overlay at all, so there is
 * nothing to mismatch on hydration.
 *
 * ## Steps that point at nothing
 *
 * Rails differ by role and collapse on a phone, and a step whose target is not
 * on screen would otherwise be an arrow pointing into a corner. Any target that
 * is missing or zero-sized drops out of the tour before it starts, so the
 * numbering the reader sees ("2 of 4") counts only steps they will be shown.
 */

interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The visible element for a target, not merely the first one.
 *
 * Every rail here renders twice on a phone — once as the side rail and once as
 * the bottom bar — with only one of the pair displayed. `querySelector` would
 * hand back whichever came first in the document, which is the hidden one about
 * half the time, and a zero-sized rect reads as "this step does not apply".
 */
function visibleTarget(href: string): Element | null {
  const found = document.querySelectorAll(`[data-tour="${CSS.escape(href)}"]`);
  for (const element of found) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return element;
  }
  return null;
}

function measure(targets: readonly string[]): string {
  if (typeof document === "undefined") return "";

  return targets
    .map((href) => {
      const element = visibleTarget(href);
      if (!element) return "";
      const box = element.getBoundingClientRect();
      // Rounded, so a sub-pixel reflow does not count as a change worth a
      // render — this string is compared on every scroll event.
      return [box.top, box.left, box.width, box.height]
        .map(Math.round)
        .join(",");
    })
    .join("|");
}

/*
  Module scope, so the reference is stable and React does not resubscribe on
  every render. `scroll` is captured, because the thing that moves a rail item
  is usually a scroll on some container inside the page rather than the window.
*/
function subscribeToLayout(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  window.addEventListener("scroll", onChange, true);

  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("scroll", onChange, true);
    observer.disconnect();
  };
}

function parse(snapshot: string): (Rect | null)[] {
  if (!snapshot) return [];

  return snapshot.split("|").map((part) => {
    if (!part) return null;
    const [top, left, width, height] = part.split(",").map(Number);
    return { top, left, width, height };
  });
}

export function ConsoleTour({ tour }: { tour: Tour }) {
  const [index, setIndex] = useState(0);
  const [gone, setGone] = useState(false);

  const snapshot = useSyncExternalStore(
    subscribeToLayout,
    () => measure(tour.steps.map((step) => step.target)),
    () => "",
  );

  const rects = parse(snapshot);
  // Only the steps whose target is actually on this screen, paired with where
  // it is. Everything below counts in terms of this list.
  const live = tour.steps
    .map((step, at) => ({ step, rect: rects[at] }))
    .filter(
      (entry): entry is { step: (typeof tour.steps)[number]; rect: Rect } =>
        Boolean(entry.rect),
    );

  const current = live[Math.min(index, live.length - 1)];

  // Bring the target into view before pointing at it. An effect is the right
  // tool here precisely because it sets no state — it only scrolls.
  useEffect(() => {
    if (gone || !current) return;
    visibleTarget(current.step.target)?.scrollIntoView({ block: "nearest" });
  }, [current, gone]);

  if (gone || live.length === 0) return null;

  async function finish() {
    setGone(true);
    try {
      await fetch("/api/tour", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tour: tour.id }),
      });
    } catch {
      /*
        Swallowed on purpose. The tour is already gone from the screen, and the
        worst case is that it appears again next time — which is a far better
        outcome than an error toast over a welcome.
      */
    }
  }

  const first = index === 0;
  const last = index >= live.length - 1;
  const { rect } = current;

  // Below the target where there is room beneath it, above it otherwise. The
  // rail runs down the left on a desktop and along the bottom on a phone, so
  // both cases are ordinary rather than edge cases.
  const below = rect.top + rect.height + 200 < window.innerHeight;
  const cardTop = below ? rect.top + rect.height + 12 : undefined;
  const cardBottom = below ? undefined : window.innerHeight - rect.top + 12;
  const cardLeft = Math.min(Math.max(12, rect.left), window.innerWidth - 340);

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={tour.greeting}
    >
      {/*
        The dim is a shadow spread from the hole rather than four panels around
        it, so the cut-out keeps its corner radius and there are no seams where
        the panels meet.
      */}
      <div
        className="pointer-events-none absolute rounded-lg ring-2 ring-white/70 transition-all duration-200"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
        }}
      />

      {/* Catches the click that would otherwise land on the console beneath. */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Skip the tour"
        onClick={finish}
      />

      <div
        className="bg-popover text-popover-foreground absolute w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border p-4 shadow-lg"
        style={{ top: cardTop, bottom: cardBottom, left: cardLeft }}
      >
        {first ? (
          <div className="mb-3 flex flex-col gap-1 border-b pb-3">
            <p className="text-base font-semibold">{tour.greeting}</p>
            <p className="text-muted-foreground text-sm">{tour.opening}</p>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{current.step.title}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={finish}
            aria-label="Skip the tour"
            className="-mt-1 -mr-1 shrink-0"
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {current.step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {live.map((entry, at) => (
              <span
                key={entry.step.target}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  at === index ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* No Back on the first card: a disabled button that has never been
                usable is a control to work out rather than one to ignore. */}
            {first ? null : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndex(index - 1)}
              >
                <ArrowLeftIcon className="size-3.5" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={last ? finish : () => setIndex(index + 1)}
            >
              {last ? "Done" : "Next"}
              {last ? null : <ArrowRightIcon className="size-3.5" />}
            </Button>
          </div>
        </div>

        <p className="text-faint mt-2 text-xs">
          Step {index + 1} of {live.length}
        </p>
      </div>
    </div>
  );
}
