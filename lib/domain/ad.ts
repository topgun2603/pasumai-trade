import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/lib/auth/claims";

/**
 * Paid placements: what an ad is, where it may go, and which one wins a slot.
 *
 * ## Slots are declared, not free-form
 *
 * The obvious design is a `position` string on each ad and a component that
 * looks for whatever matches. That fails the first time somebody types
 * `landing-mid` where the page renders `landing.mid`: the ad is saved, the
 * dashboard shows it as placed, and it appears nowhere. Nothing errors, so
 * nobody finds out until the advertiser asks why their campaign was invisible.
 *
 * So the slots the product actually has are a closed list — {@link AD_SLOTS} —
 * and an ad names one of them. A slot that no page renders is a bug that shows
 * up as a failing test rather than as an unhappy advertiser, and the admin
 * screen can list the real placements instead of asking somebody to remember
 * them.
 *
 * ## Format belongs to the slot, not the ad
 *
 * A slot knows what shape fits it. The strip under a console rail is a banner
 * whatever is put in it; the band between two landing sections is a section
 * whatever is put in it. Letting an ad declare its own format is letting
 * somebody place a full-width section band inside a 48px strip.
 *
 * ## Nothing here touches Firestore or React
 *
 * Eligibility, scheduling and rotation are arithmetic over plain values, so
 * they are tested directly rather than through a page. The reader supplies
 * `at` — a timestamp — rather than this module calling `Date.now()`, because
 * the same call has to give the same answer on the server and on the client,
 * and because React Compiler will not allow a clock read inside render.
 */

/** How a placement is drawn. Fixed by the slot; see the note above. */
export type AdFormat = "banner" | "section" | "card";

/**
 * Which console (or the public site) a slot lives on.
 *
 * No `franchise`: a franchise reads the buying console, so its slots are the
 * buying ones. Singling a franchise out is what the role target is for, and a
 * surface no page renders would be a slot that can be sold and never shown.
 */
export type AdSurface = "landing" | "farm" | "buying" | "agency";

export interface AdSlot {
  readonly id: string;
  readonly format: AdFormat;
  readonly surface: AdSurface;
  /** What operations sees in the placement list. */
  readonly label: string;
  /** Where on the page it actually appears, in words somebody can check. */
  readonly hint: string;
}

/**
 * Every placement the product renders.
 *
 * Adding a slot here is half the work; the other half is rendering
 * `<AdSlot id="…">` somewhere. A slot listed and never rendered sells space
 * that does not exist, so `ad.test.ts` asserts the two lists agree.
 */
export const AD_SLOTS: readonly AdSlot[] = [
  {
    id: "landing.banner",
    format: "banner",
    surface: "landing",
    label: "Landing — top banner",
    hint: "A strip directly under the site header, above the hero.",
  },
  {
    id: "landing.afterPrices",
    format: "section",
    surface: "landing",
    label: "Landing — after live prices",
    hint: "A full-width band between the price table and the bargaining demo.",
  },
  {
    id: "landing.afterFarmers",
    format: "section",
    surface: "landing",
    label: "Landing — after the farmer section",
    hint: "A full-width band between the farmer story and the buyer story.",
  },
  {
    id: "farm.home",
    format: "card",
    surface: "farm",
    label: "Farm console — home",
    hint: "A card in the farmer's home feed, under the day's summary.",
  },
  {
    id: "farm.banner",
    format: "banner",
    surface: "farm",
    label: "Farm console — banner",
    hint: "A strip across the top of every farm screen.",
  },
  {
    id: "buying.home",
    format: "card",
    surface: "buying",
    label: "Buyer console — home",
    hint: "A card in the buyer's home feed, under the day's summary.",
  },
  {
    id: "agency.home",
    format: "card",
    surface: "agency",
    label: "Agency console — home",
    hint: "A card on the transport and manpower home screen.",
  },
] as const;

export function findSlot(id: string): AdSlot | undefined {
  return AD_SLOTS.find((slot) => slot.id === id);
}

/** The slots on one surface, for the admin screen's grouping. */
export function slotsOn(surface: AdSurface): AdSlot[] {
  return AD_SLOTS.filter((slot) => slot.surface === surface);
}

export interface AdCreative {
  readonly headline: string;
  readonly body?: string;
  /**
   * A **storage path**, not a URL — signed at read time, the way portraits
   * are. See lib/firebase/photo-url.ts for why the bucket is not public.
   */
  readonly imagePath?: string;
  readonly imageAlt?: string;
  readonly ctaLabel?: string;
  readonly href?: string;
}

export interface Ad {
  readonly id: string;
  /** What operations calls it internally. Never shown to a reader. */
  readonly name: string;
  /** Who is paying. Shown to the reader as the disclosure line. */
  readonly advertiser: string;
  readonly slotId: string;
  readonly creative: AdCreative;
  /**
   * Locales this may show in. Empty means all six — the common case, and a
   * safer default than an empty list meaning none.
   */
  readonly locales: readonly Locale[];
  /**
   * Roles this may show to. Empty means everyone who can see the slot. Only
   * meaningful on console slots; a landing slot has no signed-in reader.
   */
  readonly roles: readonly Role[];
  readonly startsAt?: Date;
  readonly endsAt?: Date;
  /**
   * Share of impressions against other live ads in the same slot, 1–10.
   * Two ads at 1 and 3 split the slot one quarter to three quarters.
   */
  readonly weight: number;
  /** Off is off, whatever the dates say. The switch operations reaches for. */
  readonly active: boolean;
  readonly createdAt: Date;
  /**
   * The creative image as something a browser can load, filled in at read.
   *
   * Deliberately *beside* `creative.imagePath` rather than replacing it. The
   * admin form round-trips an ad through the edit dialog and back to the save
   * endpoint, and if signing overwrote the path then editing a placement
   * without touching its image would store an hour-long signed URL as the
   * permanent path — an image that works until it silently stops.
   */
  readonly signedImage?: string;
}

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 10;

/**
 * Is this ad running right now?
 *
 * Both bounds are optional and inclusive of the start, exclusive of the end —
 * an ad ending on the 1st does not run on the 1st, which is what "until the
 * 1st" means to the person who booked it.
 */
export function isLive(ad: Ad, at: number): boolean {
  if (!ad.active) return false;
  if (ad.startsAt && at < ad.startsAt.getTime()) return false;
  if (ad.endsAt && at >= ad.endsAt.getTime()) return false;
  return true;
}

/** Why an ad is not currently showing, in words for the admin list. */
export function adState(ad: Ad, at: number): "live" | "paused" | "scheduled" | "ended" {
  if (!ad.active) return "paused";
  if (ad.startsAt && at < ad.startsAt.getTime()) return "scheduled";
  if (ad.endsAt && at >= ad.endsAt.getTime()) return "ended";
  return "live";
}

export interface Audience {
  readonly slotId: string;
  readonly at: number;
  readonly locale?: Locale;
  readonly role?: Role;
}

/** Everything that could fill this slot for this reader, in a stable order. */
export function eligible(ads: readonly Ad[], audience: Audience): Ad[] {
  return ads
    .filter((ad) => {
      if (ad.slotId !== audience.slotId) return false;
      if (!isLive(ad, audience.at)) return false;
      // An empty target list means "no restriction", so it passes before the
      // reader's own value is even considered — which is what makes an
      // unsigned-in landing reader eligible for an untargeted ad.
      if (ad.locales.length > 0 && (!audience.locale || !ad.locales.includes(audience.locale)))
        return false;
      if (ad.roles.length > 0 && (!audience.role || !ad.roles.includes(audience.role)))
        return false;
      return true;
    })
    // Oldest first. Rotation indexes into this list, so the order has to be
    // the same on every render of the same set — sorting by a mutable field
    // would make two servers disagree about whose ad is showing.
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
}

/**
 * One ad out of the eligible set, by weight.
 *
 * Deterministic on `rotation`: the caller passes a number, the same number
 * always yields the same ad. That is not a limitation, it is the requirement —
 * a server render and the hydration that follows it must agree, and
 * `Math.random()` in a component guarantees they will not.
 *
 * The caller decides how often it turns over by choosing what to derive
 * `rotation` from. {@link rotationFor} does the usual thing.
 */
export function pick(candidates: readonly Ad[], rotation: number): Ad | null {
  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, ad) => sum + clampWeight(ad.weight), 0);
  if (total <= 0) return candidates[0];

  // A non-negative offset even for a negative rotation, so a caller doing its
  // own arithmetic cannot land outside the list.
  let cursor = ((Math.trunc(rotation) % total) + total) % total;

  for (const ad of candidates) {
    cursor -= clampWeight(ad.weight);
    if (cursor < 0) return ad;
  }

  return candidates[candidates.length - 1];
}

/**
 * A rotation number that turns over every few minutes.
 *
 * Long enough that a reader scrolling one page sees one ad rather than a
 * flicker of three, short enough that two people opening the site an hour
 * apart are not shown the same one. Derived from the clock rather than the
 * reader, so no identifier has to be stored to make rotation work.
 */
export const ROTATION_MS = 5 * 60 * 1000;

export function rotationFor(at: number): number {
  return Math.floor(at / ROTATION_MS);
}

/** The whole selection, as a page calls it. */
export function placeAd(ads: readonly Ad[], audience: Audience): Ad | null {
  return pick(eligible(ads, audience), rotationFor(audience.at));
}

function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) return MIN_WEIGHT;
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(weight)));
}

/**
 * Links an ad may point at.
 *
 * An advertiser types this and operations pastes it, so it is checked rather
 * than trusted. `javascript:` and `data:` are the two that turn a paid
 * placement into script execution on our origin; both are rejected here rather
 * than sanitised, because there is no legitimate ad that needs either.
 */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value === "") return false;
  // Internal, and not protocol-relative — `//evil.example` is an off-site link
  // wearing a leading slash.
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export interface AdValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/**
 * What operations may save.
 *
 * Returns every problem rather than the first, so somebody filling a form
 * learns all of what is wrong in one attempt instead of one field per save.
 */
export function validateAd(input: {
  name?: unknown;
  advertiser?: unknown;
  slotId?: unknown;
  headline?: unknown;
  body?: unknown;
  href?: unknown;
  ctaLabel?: unknown;
  imagePath?: unknown;
  imageAlt?: unknown;
  weight?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
}): AdValidation {
  const errors: string[] = [];
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  if (text(input.name) === "") errors.push("Give the placement a name.");
  if (text(input.advertiser) === "")
    errors.push("Say who is paying for it — the reader is told.");

  const slot = findSlot(text(input.slotId));
  if (!slot) errors.push("Choose a placement that exists.");

  if (text(input.headline) === "") errors.push("A placement needs a headline.");

  const href = text(input.href);
  if (href !== "" && !isSafeHref(href))
    errors.push("The link must be an https address or a path on this site.");
  if (text(input.ctaLabel) !== "" && href === "")
    errors.push("A button with no link goes nowhere. Add the address.");

  const imagePath = text(input.imagePath);
  if (imagePath !== "" && text(input.imageAlt) === "")
    errors.push("Describe the image, so a reader who cannot see it is not lost.");
  // A section band is image-led by design: without one it is a coloured box
  // with a sentence in it, which is worse than leaving the slot empty.
  if (slot?.format === "section" && imagePath === "")
    errors.push("A section placement needs an image.");

  const weight = Number(input.weight);
  if (!Number.isFinite(weight) || weight < MIN_WEIGHT || weight > MAX_WEIGHT)
    errors.push(`Share must be between ${MIN_WEIGHT} and ${MAX_WEIGHT}.`);

  const starts = toDate(input.startsAt);
  const ends = toDate(input.endsAt);
  if (input.startsAt && !starts) errors.push("The start date is not a date.");
  if (input.endsAt && !ends) errors.push("The end date is not a date.");
  if (starts && ends && ends.getTime() <= starts.getTime())
    errors.push("It cannot end before it starts.");

  return { ok: errors.length === 0, errors };
}

/** Accepts a Date, an ISO string or a millisecond number; anything else is null. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
