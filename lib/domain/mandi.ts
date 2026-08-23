import type { QuantityUnit } from "./enums";
import { money, type Money } from "./money";

/**
 * Mandi rates from Agmarknet, in the units this platform actually trades in.
 *
 * ## The conversion is the whole point of this file
 *
 * **Agmarknet quotes per quintal.** Every listing here is priced per kilo, per
 * crate, per bag or per tonne. Importing a rate without converting it makes
 * every figure a hundred times too high — and it will not look absurd enough
 * to catch, because ₹2,400 reads perfectly well as a price for something. The
 * same class of mistake as the paise that were silently rounded away for
 * months: wrong by a clean factor, and plausible at a glance.
 *
 * So the conversion lives in one place, it is tested, and no caller multiplies
 * or divides by a hundred on its own.
 *
 * ## Two units it refuses
 *
 * A crate is not a weight. Neither is a bag. How many kilos are in one depends
 * on the crop, the packer and the district, and the platform does not record
 * it — so there is no honest number to convert a per-quintal rate into, and
 * this returns `null` rather than inventing one. A screen with no mandi
 * reference is fine; a screen with a made-up one is not.
 */

/** One quintal, in kilograms. Fixed by definition, not by convention. */
export const QUINTAL_KG = 100;

/**
 * How many of a unit make up one quintal, or `null` where nobody can say.
 *
 * `null` is a real answer here and not a gap to fill in later — see the note
 * above about crates.
 */
const PER_QUINTAL: Record<QuantityUnit, number | null> = {
  kg: QUINTAL_KG,
  quintal: 1,
  tonne: 0.1,
  crate: null,
  bag: null,
};

/**
 * A rate quoted per quintal in whole rupees, restated per platform unit.
 *
 * Agmarknet gives whole rupees per quintal; this returns minor units, so the
 * paise that fall out of dividing by a hundred survive — ₹2,450 a quintal is
 * ₹24.50 a kilo, and rounding that to ₹25 is two per cent on every kilo.
 */
export function perUnit(
  rupeesPerQuintal: number,
  unit: QuantityUnit,
): Money | null {
  const per = PER_QUINTAL[unit];
  if (per === null) return null;
  if (!Number.isFinite(rupeesPerQuintal) || rupeesPerQuintal < 0) return null;

  // Paise first, then divide — the other order loses the paise to integer
  // truncation before they can be kept.
  return money(Math.round((rupeesPerQuintal * 100) / per));
}

/** Whether a unit can carry a mandi reference at all. */
export function comparableUnit(unit: QuantityUnit): boolean {
  return PER_QUINTAL[unit] !== null;
}

/* -------------------------------------------------------------------------
   Matching Agmarknet's names to ours
   ------------------------------------------------------------------------- */

/**
 * What each catalogue crop is called on Agmarknet.
 *
 * Their commodity strings are not our ids and are not stable across markets —
 * "Bhindi(Ladies Finger)", "Green Chilli", "Arecanut(Betelnut/Supari)". Several
 * of our crops appear under more than one name depending on who typed the
 * return, so this maps one crop to a list and the first match wins.
 *
 * Held here rather than in Controls for now because it is a fixed property of
 * the two vocabularies rather than a commercial setting. It will need adding
 * to when the catalogue grows, and `mandi.test.ts` fails if a crop is added
 * with no mapping — which is the reminder.
 */
export const AGMARKNET_NAMES: Record<string, readonly string[]> = {
  tomato: ["Tomato"],
  banana: ["Banana", "Banana - Green"],
  onion: ["Onion"],
  brinjal: ["Brinjal"],
  turmeric: ["Turmeric"],
  groundnut: ["Groundnut", "Groundnut (Split)", "Groundnut pods (raw)"],
  mango: ["Mango"],
  drumstick: ["Drumstick"],
  chilli: ["Green Chilli", "Dry Chillies", "Chili Red"],
  coconut: ["Coconut", "Coconut Seed"],
};

/** Our crop id for one of their commodity strings, if we know it. */
export function cropForCommodity(commodity: string): string | undefined {
  const wanted = commodity.trim().toLowerCase();
  for (const [crop, names] of Object.entries(AGMARKNET_NAMES)) {
    if (names.some((name) => name.toLowerCase() === wanted)) return crop;
  }
  return undefined;
}

/* -------------------------------------------------------------------------
   The rate itself
   ------------------------------------------------------------------------- */

export interface MandiQuote {
  readonly cropId: string;
  readonly commodity: string;
  readonly market: string;
  readonly district: string;
  readonly state: string;
  /** Minor units per platform unit, already converted. */
  readonly low: number;
  readonly high: number;
  /**
   * The most-traded price, not the average of low and high.
   *
   * Agmarknet's `modal_price` is where the volume was, which is the single
   * figure worth quoting — the midpoint of a min and a max is a number no
   * transaction actually happened at.
   */
  readonly modal: number;
  readonly unit: QuantityUnit;
  readonly asOf: Date;
}

/**
 * One raw Agmarknet record, converted, or `null` if it cannot be trusted.
 *
 * Everything here arrives as a string from a government endpoint that has been
 * typed into by market staff, so every field is checked. A row that does not
 * parse is dropped rather than rendered as `NaN` on a ticker on the front
 * page.
 */
export interface AgmarknetRecord {
  State?: unknown;
  District?: unknown;
  Market?: unknown;
  Commodity?: unknown;
  Variety?: unknown;
  Grade?: unknown;
  Arrival_Date?: unknown;
  Min_Price?: unknown;
  Max_Price?: unknown;
  Modal_Price?: unknown;
}

export function readQuote(
  raw: AgmarknetRecord,
  unit: QuantityUnit,
): MandiQuote | null {
  const commodity = typeof raw.Commodity === "string" ? raw.Commodity : "";
  const cropId = cropForCommodity(commodity);
  if (!cropId) return null;

  /*
    Prices arrive as strings and are not always whole — a real row reads
    `"Modal_Price": "21536.62"`. `Number` takes both, and `perUnit` rounds to
    the paise afterwards.
  */
  const low = perUnit(Number(raw.Min_Price), unit);
  const high = perUnit(Number(raw.Max_Price), unit);
  const modal = perUnit(Number(raw.Modal_Price), unit);
  if (!low || !high || !modal) return null;

  // A zero modal means the row exists but nothing traded. Not a price.
  if (modal.minorUnits <= 0) return null;

  const asOf = readArrivalDate(raw.Arrival_Date);
  if (!asOf) return null;

  return {
    cropId,
    commodity,
    market: typeof raw.Market === "string" ? raw.Market : "",
    district: typeof raw.District === "string" ? raw.District : "",
    state: typeof raw.State === "string" ? raw.State : "",
    low: low.minorUnits,
    high: high.minorUnits,
    modal: modal.minorUnits,
    unit,
    asOf,
  };
}

/** Their date format, for a filter value. `DD/MM/YYYY`. */
export function arrivalDateParam(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/**
 * Agmarknet's date, which is `DD/MM/YYYY`.
 *
 * Parsed by hand rather than handed to `new Date()`, which reads `03/08/2026`
 * as the third of August in some runtimes and the eighth of March in others.
 * A mandi rate labelled with the wrong month is worse than one labelled with
 * none.
 */
export function readArrivalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  // Rejects 31/02: `Date.UTC` rolls it forward to March rather than failing.
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) {
    return null;
  }
  return date;
}

/* -------------------------------------------------------------------------
   How old is too old
   ------------------------------------------------------------------------- */

/**
 * Mandis upload by hand and many do not upload at all, so a gap of a day is
 * ordinary and a gap of a week means that market has gone quiet. Past this,
 * the figure stops being "today's rate" and starts being history.
 */
export const STALE_AFTER_DAYS = 4;

export function daysOld(quote: { asOf: Date }, now: number): number {
  return Math.floor((now - quote.asOf.getTime()) / 86_400_000);
}

export function isStale(quote: { asOf: Date }, now: number): boolean {
  return daysOld(quote, now) > STALE_AFTER_DAYS;
}

/**
 * What a ticker should show: freshest first, one per crop, stale ones dropped.
 *
 * One per crop because a ticker repeating tomato from four markets is a ticker
 * nobody reads to the end of, and the nearest market's figure is the one that
 * means anything to somebody standing in that district.
 */
export function tickerQuotes(
  quotes: readonly MandiQuote[],
  now: number,
): MandiQuote[] {
  const best = new Map<string, MandiQuote>();

  for (const quote of quotes) {
    if (isStale(quote, now)) continue;
    const held = best.get(quote.cropId);
    if (!held || quote.asOf.getTime() > held.asOf.getTime()) {
      best.set(quote.cropId, quote);
    }
  }

  return [...best.values()].sort((a, b) => a.cropId.localeCompare(b.cropId));
}
