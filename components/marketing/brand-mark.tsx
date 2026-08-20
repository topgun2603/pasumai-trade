import { cn } from "@/lib/utils";

/**
 * The two buds, as path data.
 *
 * Exported because the loader draws the same pair — it animates them, so it
 * cannot reuse the component, and a second copy of the geometry is a second
 * drawing that quietly stops matching the first. `LEAD` is the larger bud.
 */
export const BRAND_LEAF_LEAD = "M25 32C22.2 22.2 27.2 11 38 5 41.2 16.4 36 27.8 25 32Z";
export const BRAND_LEAF_TRAIL =
  "M22.4 33.2C14.2 30.4 8.2 22 7.8 11.4 17 13.8 22.4 21.4 23.2 31.8Z";

/**
 * The Pasumai Trade mark: two leaf buds on a stem.
 *
 * The ring is gone. It was a half-circle the leaves grew out of, and it did two
 * things badly — it read as a seal or a badge at any size worth putting in a
 * header, and at sixteen pixels it collapsed into a grey smudge that took the
 * leaves down with it. What is left is the part that meant something.
 *
 * The two buds are deliberately unequal and set in a V. A matched pair reads as
 * a logo made with a mirror tool; one leading bud with a smaller one behind it
 * reads as a plant, and the offset is what makes the shape identifiable in a
 * browser tab rather than merely present.
 *
 * Drawn rather than shipped as an image file: an SVG scales from a favicon to a
 * hero from one definition, and it takes its colour from the surrounding text —
 * so the dark theme needs no second asset.
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
        The stem, short and thick. It was longer when a ring enclosed it; on its
        own a thin stalk is the first thing to disappear when the mark is scaled
        down, and a sprout without one reads as two loose leaves.
      */}
      <path
        d="M24 43.5V31"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
      />

      {/* The leading bud, reaching up and to the right. */}
      <path
        d={BRAND_LEAF_LEAD}
        fill="currentColor"
      />

      {/*
        The second bud, smaller and held back. The lighter fill puts it behind
        the first rather than beside it, which is what gives a flat mark depth
        without a second colour.
      */}
      <path
        d={BRAND_LEAF_TRAIL}
        fill="currentColor"
        opacity="0.68"
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
          Empowering Farmers
        </span>
      </span>
    </span>
  );
}
