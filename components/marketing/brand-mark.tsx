import { cn } from "@/lib/utils";

/**
 * The three leaves, as path data.
 *
 * Exported because the loader draws the same set — it animates them, so it
 * cannot reuse the component, and a second copy of the geometry is a second
 * drawing that quietly stops matching the first. `CENTRE` is the upright leaf;
 * the other two are its pair, mirrored about x=24.
 */
export const BRAND_LEAF_CENTRE = "M24 4C30.5 11.5 32.5 22 24 32 15.5 22 17.5 11.5 24 4Z";
export const BRAND_LEAF_LEFT = "M24 31.5C18 33.5 10.5 29.5 6.5 18.5 15 18.5 22 23 24 31.5Z";
export const BRAND_LEAF_RIGHT = "M24 31.5C30 33.5 37.5 29.5 41.5 18.5 33 18.5 26 23 24 31.5Z";

/**
 * The Pasumai Trade mark: a three-leaf sprout, optionally in its dish.
 *
 * ## Why three leaves and not two
 *
 * The mark was two unequal buds in a V. Three leaves — one upright, two swept
 * down and out — is the shape of a seedling that has actually put out its
 * first true leaves, which is closer to what the platform is about than a pair
 * of shoots. It also gives the silhouette a stable base: two leaves in a V
 * float, three sit.
 *
 * ## The dish is opt-in, and that is deliberate
 *
 * An earlier version of this mark had a ring, and the ring was removed because
 * at sixteen pixels it collapsed into a grey smudge and took the leaves down
 * with it. That lesson still holds, so the dish is not on by default — it is
 * asked for, and only where the mark is drawn large enough for a hairline to
 * survive: the header and footer lockups, the installed-app icon. The rails
 * draw the mark at 16–20px and get the leaves alone.
 *
 * One geometry, two dressings. A brand with a container and a bare form is
 * ordinary; a brand with two different drawings is a mistake waiting to be
 * noticed.
 *
 * ## What is left out
 *
 * No bud between the leaves and no midribs. Both are visible in the reference
 * and neither survives a favicon — and worse, the bud reads *lighter* than the
 * leaves there, which a single-colour mark taking its fill from `currentColor`
 * cannot reproduce: a translucent shape drawn over an opaque one comes out
 * darker, not lighter.
 *
 * Drawn rather than shipped as an image file: an SVG scales from a favicon to a
 * hero from one definition, and it takes its colour from the surrounding text —
 * so the dark theme needs no second asset.
 */
export function BrandMark({
  className,
  dish = false,
}: {
  className?: string;
  /**
   * Draw the dish around the sprout. For display sizes only — see above.
   */
  dish?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {/*
        The dish: a hairline, well faded. It is glass in the reference, and
        glass in a flat mark is a line you can see past rather than a border —
        at full strength it becomes a badge, and the leaves stop being the
        subject.
      */}
      {dish ? (
        <circle
          cx="24"
          cy="24"
          r="21.4"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity="0.3"
        />
      ) : null}

      {/*
        The stem, short and thick. A thin stalk is the first thing to disappear
        when the mark is scaled down, and a sprout without one reads as three
        loose leaves. Drawn before the leaves so their bases cover where it
        joins.
      */}
      <path
        d="M24 41.5V30"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/*
        The pair, set behind the upright leaf. The lighter fill is what gives a
        flat mark depth without a second colour — the same trick the two-bud
        version used, now doing it for a pair rather than a single trailing bud.
      */}
      <path d={BRAND_LEAF_LEFT} fill="currentColor" opacity="0.72" />
      <path d={BRAND_LEAF_RIGHT} fill="currentColor" opacity="0.72" />

      {/* The upright leaf, in front and at full strength. */}
      <path d={BRAND_LEAF_CENTRE} fill="currentColor" />
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
      {/* Big enough for the dish, which is the whole reason it is drawn here
        and not in the rails. */}
      <BrandMark dish className={cn("text-primary size-9", markClassName)} />
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
