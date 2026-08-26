import "server-only";

import {
  AD_SLOTS,
  placeAd,
  slotsOn,
  type Ad,
  type AdCreative,
  type AdSurface,
} from "@/lib/domain/ad";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/lib/auth/claims";

import { adminDb, hasAdminCredentials } from "./admin";
import { signedPhoto } from "./photo-url";

/**
 * The placements, out of Firestore.
 *
 * ## One read for the whole book, not one per slot
 *
 * A page renders two or three slots, and the obvious implementation queries
 * once per slot. That is three round trips to answer a question about a
 * collection that holds a few dozen documents at most — an ad book is not a
 * listings table. {@link readAds} fetches the lot once and callers filter it in
 * memory with `placeAd`, so a page with three placements costs one read.
 *
 * ## Never the reason a page fails
 *
 * Every function here swallows its errors and returns nothing. A landing page
 * that 500s because an advertising query timed out has traded revenue for
 * revenue and lost the reader as well. No credentials — a local checkout, a
 * preview deployment — is the same case: no ads, page fine.
 */

/** Storage paths are signed at read; see lib/firebase/photo-url.ts. */
async function shapeCreative(raw: Record<string, unknown>): Promise<AdCreative> {
  const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

  return {
    headline: text(raw.headline) ?? "",
    body: text(raw.body),
    imagePath: text(raw.imagePath),
    imageAlt: text(raw.imageAlt),
    ctaLabel: text(raw.ctaLabel),
    href: text(raw.href),
  };
}

/** Firestore hands back a Timestamp; a mock or a seed may hand back a string. */
function date(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return (value as { toDate(): Date }).toDate();
    } catch {
      return undefined;
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function strings<T extends string>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value.filter((v) => typeof v === "string") as T[]) : [];
}

async function shape(id: string, raw: Record<string, unknown>): Promise<Ad> {
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : id,
    advertiser: typeof raw.advertiser === "string" ? raw.advertiser : "",
    slotId: typeof raw.slotId === "string" ? raw.slotId : "",
    creative: await shapeCreative(raw),
    locales: strings<Locale>(raw.locales),
    roles: strings<Role>(raw.roles),
    startsAt: date(raw.startsAt),
    endsAt: date(raw.endsAt),
    weight: typeof raw.weight === "number" ? raw.weight : 1,
    // Absent means off. A document written by hand, or half-written by a
    // failed save, should not start showing to the public on its own.
    active: raw.active === true,
    createdAt: date(raw.createdAt) ?? new Date(0),
  };
}

/**
 * Every ad in the book, live or not.
 *
 * The admin screen wants all of them — a paused campaign it cannot see is a
 * campaign it cannot resume. Public pages call this too and filter with
 * `placeAd`, which drops everything not currently running.
 */
export async function readAds(): Promise<{ ads: Ad[]; live: boolean }> {
  if (!hasAdminCredentials()) return { ads: [], live: false };

  try {
    const snapshot = await adminDb().collection("ads").get();
    const ads = await Promise.all(snapshot.docs.map((doc) => shape(doc.id, doc.data())));
    return { ads, live: true };
  } catch {
    return { ads: [], live: false };
  }
}

/**
 * A creative with its image turned into something a browser can load.
 *
 * Kept separate from `shape` and called only on the ad actually chosen: signing
 * is cheap but not free, and signing forty creatives to display one is forty
 * times the work for the same page.
 */
export async function withSignedImage(ad: Ad): Promise<Ad> {
  if (!ad.creative.imagePath) return ad;
  // `signedImage`, never `creative.imagePath` — see the note on the field.
  return { ...ad, signedImage: await signedPhoto(ad.creative.imagePath) };
}

/**
 * Everything to show this reader, keyed by slot — one read for the page.
 *
 * The alternative is an async `<AdSlot>` that reads for itself, which is
 * tidier to write and costs a Firestore round trip per placement on a page
 * that renders three. So the page resolves the whole book once, `placeAd`
 * picks per slot in memory, and only the chosen creatives are signed.
 *
 * The audience is applied here rather than at render, so a component cannot
 * accidentally show a farmer an ad booked for buyers by forgetting a prop.
 */
export async function readPlacements(audience: {
  at: number;
  surface?: AdSurface;
  locale?: Locale;
  role?: Role;
}): Promise<Placements> {
  const { ads } = await readAds();
  if (ads.length === 0) return new Map();

  const slots = audience.surface ? slotsOn(audience.surface) : AD_SLOTS;

  const chosen = slots
    .map((slot) => placeAd(ads, { ...audience, slotId: slot.id }))
    .filter((ad): ad is Ad => ad !== null);

  const signed = await Promise.all(chosen.map(withSignedImage));

  return new Map(signed.map((ad) => [ad.slotId, ad]));
}

/** What a page hands to each `<AdSlot>`. Empty is the normal case. */
export type Placements = ReadonlyMap<string, Ad>;
