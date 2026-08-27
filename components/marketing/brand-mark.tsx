import Image from "next/image";

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
 * The photograph the drawn mark was traced from.
 *
 * Both marks are kept, and which one a place gets is decided by size and by
 * colour rather than by preference:
 *
 *  - This one wherever the mark is drawn at roughly 24px or larger on a surface
 *    it can sit on unaltered — the lockups, and the doors people sign in at.
 *  - {@link BrandMark} in the console rails and on the profile page, at 16–20px,
 *    where a photograph collapses into a green smudge, and inside anything that
 *    needs the mark to take its colour from the text around it. A PNG cannot do
 *    `currentColor`, and no amount of exporting will make it.
 *
 * The white ground and the grey glass interior were cut out of the supplied
 * file, so the leaves sit on whatever is behind them and the dark theme needs
 * no second asset. `public/logo.png` is the untouched original.
 *
 * 256px and palette-encoded, which is 11 KB rather than the 1.1 MB the original
 * weighs — the largest this is ever drawn is 44px, so 256 covers even a 5x
 * display with room to spare.
 */
export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  /** For the mark above the fold — the site header, and the sign-in doors. */
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      // Decorative in every place it is used: the name is set beside it in the
      // lockups and carried by the heading on the sign-in pages.
      aria-hidden
      width={256}
      height={256}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/**
 * The full lockup: mark, name and tagline.
 *
 * The tagline *is* translated, and the name is not.
 *
 * The two were treated alike at first, on the argument that a tagline is part
 * of the mark rather than part of the copy. That holds for "Pasumai Trade",
 * which is what the thing is called and reads the same on every page. It does
 * not hold for "Empowering Farmers", which is a sentence making a promise — and
 * a promise a farmer cannot read is not one they have been made.
 *
 * So the tagline arrives as a prop rather than being set here: this component
 * has no locale of its own, and every place that draws the lockup has a
 * dictionary already.
 */
export function BrandLockup({
  tagline,
  className,
  markClassName,
  nameClassName,
  taglineClassName,
}: {
  /** `t.brand.tagline`, in the reader's language. */
  tagline: string;
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  taglineClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* The photograph, not the drawing. The lockup is the one place the mark
        is given room, and it sits on the page background rather than inside a
        coloured chip — which is exactly the condition a photograph needs. */}
      <BrandLogo priority className={cn("size-9", markClassName)} />
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
          {tagline}
        </span>
      </span>
    </span>
  );
}
