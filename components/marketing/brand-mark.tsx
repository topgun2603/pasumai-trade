import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The three leaves, as path data.
 *
 * All that is left of the drawn mark, and kept for one caller: the loader in
 * components/ui/loader.tsx animates these paths individually — the ring sweeps
 * and the leaves breathe — which is a thing a flat image cannot do at any file
 * size. Everywhere the mark is merely *shown* rather than animated, it is now
 * the photograph below.
 *
 * `CENTRE` is the upright leaf; the other two are its pair, mirrored about
 * x=24.
 */
export const BRAND_LEAF_CENTRE = "M24 4C30.5 11.5 32.5 22 24 32 15.5 22 17.5 11.5 24 4Z";
export const BRAND_LEAF_LEFT = "M24 31.5C18 33.5 10.5 29.5 6.5 18.5 15 18.5 22 23 24 31.5Z";
export const BRAND_LEAF_RIGHT = "M24 31.5C30 33.5 37.5 29.5 41.5 18.5 33 18.5 26 23 24 31.5Z";

/**
 * The mark. One image, everywhere it appears.
 *
 * There used to be two: this photograph at display sizes, and a drawn SVG in
 * the console rails and on the profile page at 16–20px, on the argument that a
 * photograph collapses into a green smudge that small and that only an SVG can
 * take its colour from `currentColor`.
 *
 * Both points are true and neither survived the thing they cost — the two marks
 * are not the same drawing. Somebody signing in met the photograph and then
 * found a flatter, simpler sprout in the rail of the console they landed in,
 * which reads as two brands rather than one mark at two sizes. A logo's whole
 * job is to be recognised again, so a rail that renders it slightly muddy at
 * 16px is a smaller loss than a rail that renders something else cleanly.
 *
 * The white ground and the grey glass interior were cut out of the supplied
 * file, so the leaves sit on whatever is behind them and the dark theme needs
 * no second asset. `public/logo.png` is the untouched original.
 *
 * 256px and palette-encoded, which is 11 KB rather than the 1.1 MB the original
 * weighs — the largest this is drawn is 56px, so 256 covers a 4x display with
 * room to spare, and `next/image` serves each size a variant rather than the
 * whole file.
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
 * Both are translated, the name included.
 *
 * The tagline was the easy half: "Empowering Farmers" is a sentence making a
 * promise, and a promise a farmer cannot read is not one they have been made.
 * The name is the argued half, and the argument went both ways before it
 * settled here. Against: a name is what somebody types into a search box, reads
 * off an invoice and says down a telephone, and one spelling keeps all three
 * pointing at the same business. For, and decisively: "Pasumai" is a Tamil word
 * to begin with, and a grower reading a page set wholly in their own script met
 * one line of Latin text at the top of it — the name of the platform, the word
 * they most need to recognise.
 *
 * The six spellings are the business's own, not a transliteration invented
 * here, so this file is not the place to revise them. Where the name appears
 * inside a sentence — `signin.title`, `console.greeting`, `hero.body` — the
 * dictionaries carry it with the case ending attached, because Tamil, Telugu,
 * Kannada and Malayalam fuse the following particle onto the noun and a name
 * held apart from its ending reads as a foreign object dropped into the line.
 *
 * Both arrive as props rather than being set here: this component has no locale
 * of its own, and every place that draws the lockup has a dictionary already.
 */
export function BrandLockup({
  name,
  tagline,
  className,
  markClassName,
  nameClassName,
  taglineClassName,
}: {
  /** `t.brand.name`, in the reader's script. */
  name: string;
  /** `t.brand.tagline`, in the reader's language. */
  tagline: string;
  className?: string;
  /** Sizes the white circle, not the mark inside it. See the note below. */
  markClassName?: string;
  nameClassName?: string;
  taglineClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/*
        The same white circle the console wears.

        The site header and footer used to sit the mark straight on the page,
        while the four console rails, the mobile sheet, the profile header, the
        offline and renew screens and the console welcome all put it in a chip.
        That is one mark with two treatments, met about four seconds apart — the
        header on the way in, the rail on the way out of sign-in — which is the
        same "two brands rather than one mark" problem the drawn SVG caused and
        that `BrandLogo` above was written to end.

        The chip was a green rounded square and is now a white circle. Green was
        right while the mark was a flat SVG taking its colour from
        `currentColor` and needing a ground to read against; the photograph
        wants the opposite, because its leaves were cut out of a white field and
        green behind them put the same green either side of every leaf edge. The
        shape follows the drawing rather than boxing it: the mark is a ring of
        leaves, so a circle traces it where a rounded rectangle left four
        corners of dead white around it.

        `markClassName` sizes the circle, which is the footprint the lockup
        already occupied — so adding the chip moved nothing on the page. The
        mark is a proportion of it rather than a fixed class, because the two
        callers ask for different sizes and a hardcoded inner size would be
        right for one of them.
      */}
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full bg-white",
          markClassName,
        )}
      >
        <BrandLogo priority className="size-[64%]" />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            "font-heading text-primary text-[17px] font-semibold tracking-tight whitespace-nowrap",
            nameClassName,
          )}
        >
          {name}
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
