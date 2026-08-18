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
        The sweep. An arc rather than a full ring, and open at the foot like the
        mark it comes from — a closed circle rotating is every spinner ever
        drawn, and the gap is what makes this one recognisable at 14 pixels.
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
        The leaves, breathing out of phase with the sweep. Deliberately unequal
        and offset in time — a symmetrical pair pulsing together reads as a
        loading dot, and the whole point is that it reads as something growing.
      */}
      <g
        className={cn(
          "origin-center animate-[pasumai-breathe_1.6s_ease-in-out_infinite]",
          "motion-reduce:animate-[pasumai-fade_1.8s_ease-in-out_infinite]",
        )}
      >
        <path d="M24 25.5c0-5 3.4-9 8.7-9.4.5 5.6-2.8 9.9-8.7 9.4Z" fill="currentColor" />
        <path
          d="M24 31c0-4-2.7-7.2-7-7.5-.4 4.4 2.2 7.9 7 7.5Z"
          fill="currentColor"
          opacity="0.6"
          style={{ animationDelay: "-0.8s" }}
        />
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
