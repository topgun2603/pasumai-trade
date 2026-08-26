import Image from "next/image";
import Link from "next/link";

import { findSlot, type Ad, type AdFormat } from "@/lib/domain/ad";
import type { Placements } from "@/lib/firebase/ads-read";
import { cn } from "@/lib/utils";

/**
 * One paid placement, drawn in the shape its slot calls for.
 *
 * ## An empty slot renders nothing at all
 *
 * Not a box, not a "advertisement" label, not reserved height — nothing. A
 * placeholder where an ad would be tells every reader on every page that the
 * platform is trying to sell space and failing to, and it pushes the content
 * they came for down the screen to do it. `null` is a complete answer.
 *
 * ## Always labelled
 *
 * Every format carries the advertiser's name and the word Sponsored. This is a
 * platform farmers are asked to trust with a harvest; an advertisement that
 * reads as editorial is a small deception with a large cost, and it is also
 * what the ASCI code requires of it. The label is not a prop and cannot be
 * switched off.
 *
 * ## The link is checked, and it leaves
 *
 * `rel="sponsored noopener"` on every outbound link: `sponsored` because
 * search engines are entitled to know a link was paid for, `noopener` because
 * an advertiser's page should not get a handle on the tab it was opened from.
 * The href itself was validated when it was saved — see `isSafeHref`.
 */

export interface AdSlotProps {
  slotId: string;
  /**
   * Resolved by the page in one read — see `readPlacements`. Targeting and
   * scheduling are already applied; anything in here is meant for this reader,
   * right now.
   */
  placed: Placements;
  className?: string;
}

export function AdSlot({ slotId, placed, className }: AdSlotProps) {
  const slot = findSlot(slotId);
  if (!slot) return null;

  const ad = placed.get(slotId);
  if (!ad) return null;

  return <Placement ad={ad} format={slot.format} className={className} />;
}

/**
 * Also exported on its own, because the admin screen previews a creative that
 * has not been saved yet and so cannot go through `placeAd`. One renderer for
 * both means the preview is the thing, not a drawing of the thing.
 */
export function Placement({
  ad,
  format,
  className,
}: {
  ad: Ad;
  format: AdFormat;
  className?: string;
}) {
  if (format === "banner") return <Banner ad={ad} className={className} />;
  if (format === "section") return <Section ad={ad} className={className} />;
  return <Card ad={ad} className={className} />;
}

/** The disclosure. Same words in all three formats, so it is recognisable. */
function Sponsored({ advertiser, className }: { advertiser: string; className?: string }) {
  return (
    <span
      className={cn(
        "text-faint flex items-center gap-1.5 text-[10.5px] tracking-wide uppercase",
        className,
      )}
    >
      <span className="border-border rounded border px-1 py-px leading-none">Sponsored</span>
      {advertiser ? <span className="normal-case">{advertiser}</span> : null}
    </span>
  );
}

/**
 * Wraps the whole placement in its link, or in nothing.
 *
 * An ad without an href is legitimate — a brand-awareness banner with nothing
 * to click — and wrapping it in an `<a href="">` would give a keyboard user a
 * focus stop that does nothing.
 */
function Clickable({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;

  const external = !href.startsWith("/");

  return (
    <Link
      href={href}
      className={className}
      rel="sponsored noopener"
      target={external ? "_blank" : undefined}
    >
      {children}
    </Link>
  );
}

/**
 * A strip. Text-led and short, because it sits above the content rather than
 * in the flow of it, and a tall one is a wall between a reader and the page.
 */
function Banner({ ad, className }: { ad: Ad; className?: string }) {
  const { headline, body, ctaLabel, href, imageAlt } = ad.creative;
  // Resolved at read; a storage path is not something a browser can load.
  const image = ad.signedImage;

  return (
    <aside
      aria-label="Sponsored"
      className={cn("bg-secondary/50 border-b print:hidden", className)}
    >
      <Clickable
        href={href}
        className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-2.5 transition-colors hover:bg-secondary/80"
      >
        {image ? (
          <Image
            src={image}
            alt={imageAlt ?? ""}
            width={40}
            height={40}
            className="size-8 shrink-0 rounded object-cover"
            unoptimized
          />
        ) : null}

        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium">{headline}</span>
          {body ? (
            <span className="text-muted-foreground truncate text-xs">{body}</span>
          ) : null}
        </span>

        {ctaLabel ? (
          <span className="text-primary shrink-0 text-xs font-medium underline-offset-4 hover:underline">
            {ctaLabel}
          </span>
        ) : null}

        <Sponsored advertiser={ad.advertiser} className="hidden shrink-0 sm:flex" />
      </Clickable>
    </aside>
  );
}

/**
 * A full-width band between two sections of the page.
 *
 * Image-led — the validator refuses a section placement without one — and set
 * on the secondary surface so it reads as a break in the page rather than as
 * another one of its sections.
 */
function Section({ ad, className }: { ad: Ad; className?: string }) {
  const { headline, body, ctaLabel, href, imageAlt } = ad.creative;
  // Resolved at read; a storage path is not something a browser can load.
  const image = ad.signedImage;

  return (
    <aside
      aria-label="Sponsored"
      /*
        Its own surface with a rule above and below, rather than the secondary
        tint the page's own sections use. Next to one of those — and the band
        after the farmer story is exactly that — a matching tint would merge
        the two into a single stretch, and an advertisement that reads as part
        of the page is the one thing this component must not do.
      */
      className={cn("bg-card border-y print:hidden", className)}
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-12 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-4">
          <Sponsored advertiser={ad.advertiser} />
          <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
            {headline}
          </h2>
          {body ? (
            <p className="text-muted-foreground max-w-prose leading-relaxed">{body}</p>
          ) : null}
          {ctaLabel && href ? (
            <Clickable
              href={href}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium transition-colors"
            >
              {ctaLabel}
            </Clickable>
          ) : null}
        </div>

        {image ? (
          <Clickable href={href} className="block overflow-hidden rounded-xl border">
            <Image
              src={image}
              alt={imageAlt ?? ""}
              width={1200}
              height={675}
              sizes="(min-width: 1024px) 32rem, 100vw"
              className="aspect-[16/9] w-full object-cover"
              unoptimized
            />
          </Clickable>
        ) : null}
      </div>
    </aside>
  );
}

/** A tile, sized to sit in a console feed beside the cards already there. */
function Card({ ad, className }: { ad: Ad; className?: string }) {
  const { headline, body, ctaLabel, href, imageAlt } = ad.creative;
  // Resolved at read; a storage path is not something a browser can load.
  const image = ad.signedImage;

  return (
    <aside
      aria-label="Sponsored"
      className={cn("bg-card overflow-hidden rounded-xl border print:hidden", className)}
    >
      <Clickable href={href} className="flex flex-col">
        {image ? (
          <Image
            src={image}
            alt={imageAlt ?? ""}
            width={800}
            height={450}
            sizes="(min-width: 768px) 24rem, 100vw"
            className="aspect-[16/9] w-full object-cover"
            unoptimized
          />
        ) : null}

        <div className="flex flex-col items-start gap-2 p-4">
          <Sponsored advertiser={ad.advertiser} />
          <h3 className="leading-snug font-medium">{headline}</h3>
          {body ? (
            <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
          ) : null}
          {ctaLabel && href ? (
            <span className="text-primary pt-1 text-sm font-medium underline-offset-4 hover:underline">
              {ctaLabel}
            </span>
          ) : null}
        </div>
      </Clickable>
    </aside>
  );
}
