import {
  BRAND_LEAF_CENTRE,
  BRAND_LEAF_LEFT,
  BRAND_LEAF_RIGHT,
} from "@/components/marketing/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The Pasumai loader.
 *
 * A spinner says "wait". This says "wait, and you are still on the platform you
 * thought you were" — it is the brand mark doing the waiting: the ring sweeps
 * and the two leaves breathe, the same open ring and unequal pair that sit in
 * the header.
 *
 * ## Where this belongs, and where a skeleton belongs
 *
 * They answer different questions and both are needed.
 *
 * A **skeleton** stands in for content whose shape is already known — a page
 * arriving, a table of rows. It says "this is what is coming", holds the layout
 * still, and stops the page jumping when the data lands.
 *
 * This **loader** is for work a person asked for and is waiting on: a form
 * being submitted, a request in flight, a refresh. Its shape is not known
 * because the answer is not a shape — it is a yes or a no. Drawing a skeleton
 * for a button press would promise a layout that will never appear.
 *
 * So: skeletons for arriving content, this for calls in flight. Nothing here
 * replaces the skeletons.
 *
 * ## Accessibility
 *
 * `role="status"` with a live region, so a screen reader announces that
 * something began rather than sitting in silence. The label is always rendered
 * for that reason — visually hidden when there is no room for it, never
 * omitted. Under `prefers-reduced-motion` the sweep and the scaling stop and a
 * slow fade remains: something must still change, or somebody who turns motion
 * off cannot tell a working request from a frozen one.
 */

const SIZES = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
} as const;

export type LoaderSize = keyof typeof SIZES;

export function Loader({
  size = "sm",
  className,
}: {
  size?: LoaderSize;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("shrink-0 text-current", SIZES[size], className)}
    >
      {/*
        The sweep. Two opposed arcs rather than a closed ring: a full circle
        rotating is every spinner ever drawn, and the gaps are what make this
        one recognisable at 14 pixels.

        This is the spinner, not the mark — the mark has no ring, and never did
        have this one. What the two share is the leaves below.
      */}
      <g
        className={cn(
          "origin-center animate-[pasumai-sweep_1.1s_linear_infinite]",
          "motion-reduce:animate-[pasumai-fade_1.8s_ease-in-out_infinite]",
        )}
      >
        <path
          d="M24 4a20 20 0 0 1 17.3 10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M24 44a20 20 0 0 1-17.3-10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.3"
        />
      </g>

      {/*
        The brand's own sprout, scaled down to sit inside the sweep and
        breathing out of phase with it. The paths are imported rather than
        redrawn: a second copy would be a second drawing, and it would stop
        matching the mark the first time either changed.

        The dish is not drawn here. The loader already has a ring — the sweep
        is one — and two concentric circles would read as a dial rather than
        as something growing.

        The lower pair is offset in time on purpose. Three leaves pulsing
        together read as a loading dot; the upright leaf leading and the pair
        following reads as opening.
      */}
      <g
        className={cn(
          "origin-center animate-[pasumai-breathe_1.6s_ease-in-out_infinite]",
          "motion-reduce:animate-[pasumai-fade_1.8s_ease-in-out_infinite]",
        )}
      >
        {/* Scaled about the centre of the box, so the pair keeps its
            proportions and lands inside the arcs. */}
        <g transform="translate(24 24) scale(0.52) translate(-24 -24)">
          <path
            d={BRAND_LEAF_LEFT}
            fill="currentColor"
            opacity="0.6"
            style={{ animationDelay: "-0.8s" }}
          />
          <path
            d={BRAND_LEAF_RIGHT}
            fill="currentColor"
            opacity="0.6"
            style={{ animationDelay: "-0.8s" }}
          />
          <path d={BRAND_LEAF_CENTRE} fill="currentColor" />
        </g>
      </g>
    </svg>
  );
}

/**
 * The loader with its reason beside it.
 *
 * The label is not decoration. "Loading" tells somebody the page is not broken;
 * *what* is loading tells them whether it is worth waiting for, and on a slow
 * village connection that is the difference between waiting and reloading.
 */
export function Loading({
  label,
  size = "sm",
  className,
  hideLabel = false,
}: {
  label: string;
  size?: LoaderSize;
  className?: string;
  /** Keeps the label for screen readers when the layout has no room for it. */
  hideLabel?: boolean;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("text-muted-foreground flex items-center gap-2 text-sm", className)}
    >
      <Loader size={size} />
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}

/**
 * A panel waiting on a call, centred in whatever space it has.
 *
 * For a region that has been asked to refetch and has nothing to show yet —
 * distinct from a skeleton, which is for content arriving for the first time
 * and whose shape is known.
 */
export function LoadingPanel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-3",
        className,
      )}
    >
      <Loader size="lg" className="text-primary" />
      <span role="status" aria-live="polite" className="text-sm">
        {label}
      </span>
    </div>
  );
}
