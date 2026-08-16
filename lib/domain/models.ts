/**
 * Domain models, ported from packages/core/lib/src/domain/models.dart.
 *
 * Interfaces plus free functions, not classes: these cross the RSC boundary as
 * props and class instances do not serialise. Anything that was a Dart getter
 * is a function here, named `<thing>Of(...)`.
 */
import {
  type Grade,
  type ListingStatus,
  type OrderStatus,
  type PaymentStatus,
  type PickupWindow,
  type QuantityUnit,
} from "./enums";
import { forQuantity, money, type Money } from "./money";

/**
 * A crop in the catalogue.
 *
 * Names are held per-language as **data**, not in translation files, for two
 * reasons: the catalogue grows without a rebuild, and crop names are regional
 * enough that operations must be able to edit them without a developer.
 *
 * `regional` overrides a name for one district. This is not a nicety — the
 * same crop genuinely goes by different names across Tamil Nadu, and showing a
 * farmer a word nobody in their village uses undermines the whole listing
 * flow.
 *
 * English is required; every other language is optional and falls back to it,
 * so a newly added crop is usable the moment it exists rather than blocking on
 * six translations.
 */
export interface Produce {
  readonly id: string;
  readonly names: { readonly en: string } & Readonly<
    Partial<Record<string, string>>
  >;
  /** `{ Thanjavur: { ta: "…" } }` — district first, then language. */
  readonly regional?: Readonly<
    Record<string, Readonly<Partial<Record<string, string>>>>
  >;
  readonly emoji: string;
  /**
   * Uploaded icon, held as a data URI.
   *
   * Takes precedence over the emoji when set. Icons are compressed to 128px
   * WebP in the browser and land at a few kilobytes, so they ride on the
   * document rather than costing a Storage round trip. That reasoning holds
   * for icons only — a photograph belongs in Cloud Storage.
   */
  readonly iconUrl?: string | null;
  readonly defaultUnit: QuantityUnit;
  /**
   * Typical hours from grading to unsaleable.
   *
   * Drives the freshness bands and, through them, which loads need a reefer.
   * A single platform-wide cutoff cannot serve both turmeric and mango, which
   * is why this sits on the crop. Absent means the platform default applies.
   */
  readonly shelfLifeHours?: number | null;
  /**
   * What each grade physically means, per language.
   *
   * The bargaining screen settles what grade A *pays*. This is the other half:
   * what grade A *is*. Without it the standard lives in the head of whoever
   * inspects at the farm gate, and the farmer standing next to them has a
   * written price and nothing to check the grading against.
   *
   * `{ a: { en: "…", ta: "…" } }` — grade first, then language, same shape as
   * `names` so it falls back to English the same way.
   */
  readonly grading?: Readonly<
    Partial<Record<Grade, Readonly<Partial<Record<string, string>>>>>
  >;
  /**
   * Whether the crop appears in pickers and filters.
   *
   * Crops are seasonal, so a catalogue needs a way to retire one without
   * deleting it — the listings and orders that already name it must keep
   * reading correctly long after nobody can list it again. Absent means
   * active, so every crop that predates this field stays visible.
   */
  readonly active?: boolean;
}

/** Crops a farmer may currently list. What every picker should iterate. */
export function activeProduce(catalogue: readonly Produce[]): Produce[] {
  return catalogue.filter((p) => p.active !== false);
}

/**
 * The grading standard to show, in the reader's language, falling back to
 * English. Empty when the crop has no standard written yet — and the caller
 * must say so rather than showing nothing, because a blank grading note reads
 * as "no standard applies".
 */
export function gradingNote(
  produce: Produce,
  grade: Grade,
  locale: string,
): string | undefined {
  const byLocale = produce.grading?.[grade];
  if (!byLocale) return undefined;
  return byLocale[locale] ?? byLocale.en;
}

/**
 * The name to show, most specific first: district override, then language,
 * then English.
 */
export function produceName(
  produce: Produce,
  locale: string,
  district?: string,
): string {
  if (district) {
    const override = produce.regional?.[district]?.[locale];
    if (override) return override;
  }
  return produce.names[locale] ?? produce.names.en;
}

/** Languages a crop has been named in, for the catalogue's coverage column. */
export function namedLocales(produce: Produce): string[] {
  return Object.keys(produce.names).filter((k) => produce.names[k]);
}

/** Published mandi rate for a crop in a district. */
export interface MarketRate {
  /** Per unit, minor units. */
  readonly low: number;
  readonly high: number;
  readonly district: string;
  /**
   * Named honestly in the UI — a platform trailing average must not be
   * presented as if it were a mandi price.
   */
  readonly source: string;
  readonly asOf: Date;
}

export function marketLow(rate: MarketRate): Money {
  return money(rate.low);
}

export function marketHigh(rate: MarketRate): Money {
  return money(rate.high);
}

/** One grade's price on an offer. */
export interface GradeBand {
  readonly grade: Grade;
  /** Per listed unit, in minor units. `1900` is ₹19/kg. */
  readonly ratePerUnit: number;
  /**
   * How much of this grade the band is for, in the listing's unit.
   *
   * Absent means the whole of what is available at that grade — which is what
   * every band meant before produce could be sold in parts, so old records read
   * correctly without being rewritten.
   */
  readonly quantity?: number;
}

export function bandTotal(band: GradeBand, quantity: number): Money {
  return forQuantity(band.ratePerUnit, band.quantity ?? quantity);
}

export function bandRate(band: GradeBand): Money {
  return money(band.ratePerUnit);
}

/**
 * A franchise's quote against a listing.
 *
 * Carries every grade's price, not one headline number. Grading happens
 * physically at pickup, so agreeing all three bands up front is what stops the
 * price being reopened at the roadside with a truck idling.
 */
export interface Offer {
  readonly id: string;
  readonly franchiseName: string;
  /** Best grade first. */
  readonly bands: readonly GradeBand[];
  readonly expiresAt: Date;
  /**
   * The published reference the farmer checks the offer against. This is the
   * point of the offer screen — without it the offer is a number to be trusted
   * rather than a number to be verified.
   */
  readonly marketRate: MarketRate;
}

export function bandFor(offer: Offer, grade: Grade): GradeBand | undefined {
  return offer.bands.find((b) => b.grade === grade);
}

export function hasExpiredAt(offer: Offer, now: Date): boolean {
  return now.getTime() >= offer.expiresAt.getTime();
}

/** Milliseconds remaining, floored at zero. */
export function remainingFrom(offer: Offer, now: Date): number {
  return Math.max(0, offer.expiresAt.getTime() - now.getTime());
}

/** The farmer behind a listing, as the franchise sees them. */
export interface FarmerSummary {
  readonly id: string;
  readonly name: string;
  readonly village: string;
  readonly district: string;
  /** Completed orders. The franchise's only real signal of reliability. */
  readonly completedOrders: number;
}

/** Produce a farmer has put up for sale. */
export interface Listing {
  readonly id: string;
  readonly produce: Produce;
  readonly farmer: FarmerSummary;
  readonly quantity: number;
  readonly unit: QuantityUnit;
  readonly status: ListingStatus;
  readonly createdAt: Date;
  readonly photoCount: number;
  /** Present once the franchise has quoted. */
  readonly offer?: Offer;
  /** Created offline and not yet accepted by the server. */
  readonly pendingSync: boolean;
  /** The mandi reference for this crop and district at listing time. */
  readonly marketRate: MarketRate;
}

/** Result of the franchise's inspection at pickup. */
export interface GradeResult {
  readonly grade: Grade;
  /** Actual loaded quantity, which routinely differs from the listed amount. */
  readonly weightLoaded: number;
  readonly ratePerUnit: number;
  readonly photoCount: number;
  readonly recordedAt: Date;
}

export function gradeTotal(result: GradeResult): Money {
  return forQuantity(result.ratePerUnit, result.weightLoaded);
}

export interface Driver {
  readonly name: string;
  readonly vehicleRegistration: string;
  readonly vehicleDescription: string;
}

/** An accepted offer, from confirmation through to payout. */
export interface FarmOrder {
  readonly id: string;
  /** Short, human-quotable. What a farmer reads out on the phone. */
  readonly reference: string;
  readonly produce: Produce;
  readonly farmer: FarmerSummary;
  readonly quantity: number;
  readonly unit: QuantityUnit;
  readonly bands: readonly GradeBand[];
  readonly franchiseName: string;
  readonly status: OrderStatus;
  readonly acceptedAt: Date;
  readonly pickupWindow?: PickupWindow;
  readonly driver?: Driver;
  /**
   * Four digits the driver types to confirm handover. Issued with the order
   * and cached, so it is readable with no signal at the farm gate.
   */
  readonly handoverCode?: string;
  readonly gradeResult?: GradeResult;
  readonly estimatedArrival?: Date;
  readonly paymentStatus?: PaymentStatus;
  /**
   * When the money actually reached the farmer's bank. Deliberately separate
   * from delivery: a farmer cares when they were *paid*, not when the truck
   * arrived.
   */
  readonly settledAt?: Date;
  readonly remainingDistanceKm?: number;
}

/**
 * What the farmer will receive: the graded amount once inspected, otherwise
 * the top band as an estimate.
 */
export function orderAmount(order: FarmOrder): Money {
  if (order.gradeResult) return gradeTotal(order.gradeResult);
  return bandTotal(order.bands[0], order.quantity);
}

export function isEstimate(order: FarmOrder): boolean {
  return order.gradeResult === undefined;
}

/**
 * The farmer's profile. Assembled by the franchise during onboarding — the
 * farmer never fills this in, and bank details are collected and verified
 * offline because they are the highest drop-off field in rural sign-up.
 */
export interface FarmerProfile {
  readonly name: string;
  readonly mobile: string;
  readonly village: string;
  readonly district: string;
  /**
   * Last four digits only. Farmers check the money went to the right account;
   * showing the tail prevents a call to the franchise.
   */
  readonly bankAccountTail: string;
}
