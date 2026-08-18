import { cn } from "@/lib/utils";

/**
 * The Pasumai Trade mark: two leaves growing out of a ring.
 *
 * Drawn rather than shipped as an image file, for the reason every mark on a
 * page like this should be: an SVG scales to the header, the footer and a
 * retina display from one 700-byte definition, and it takes its colour from
 * the surrounding text — so the dark theme needs no second asset.
 *
 * `currentColor` throughout. The ring and the leaves are the same green as the
 * wordmark beside them, which is what keeps the lockup reading as one object
 * rather than an icon placed next to some words.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {/*
        The ring is open at the foot. A closed circle reads as a badge or a
        seal; the gap is where the stem enters, which is what makes the whole
        thing read as something growing rather than something stamped.
      */}
      <path
        d="M24 3.5a20.5 20.5 0 1 1-9.6 38.6"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* The stem, rising from the gap in the ring through both leaves. */}
      <path
        d="M24 39.5V21.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/*
        Two leaves, deliberately unequal. A symmetrical pair reads as a logo
        drawn with a mirror tool; the smaller left leaf is what makes it read as
        a plant.
      */}
      <path
        d="M24 22.5c0-6.6 4.4-11.8 11.4-12.4.7 7.3-3.6 13-11.4 12.4Z"
        fill="currentColor"
      />
      <path
        d="M24 30.2c0-5.4-3.6-9.6-9.3-10.1-.6 5.9 2.9 10.6 9.3 10.1Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}

/**
 * The full lockup: mark, name and tagline.
 *
 * The tagline is not translated. A tagline is part of the mark rather than
 * part of the copy — it is set once, in one language, the way the wordmark is,
 * and swapping it per locale would give six different logos. Everything the
 * page actually has to *say* is translated; this is the thing it is called.
 */
export function BrandLockup({
  className,
  markClassName,
  nameClassName,
  taglineClassName,
}: {
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  taglineClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={cn("text-primary size-9", markClassName)} />
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-heading text-primary text-[17px] font-semibold tracking-tight whitespace-nowrap",
            nameClassName,
          )}
        >
          Pasumai Trade
        </span>
        <span
          className={cn(
            "text-muted-foreground text-[10.5px] whitespace-nowrap",
            taglineClassName,
          )}
        >
          Trade Green, Grow Green
        </span>
      </span>
    </span>
  );
}
