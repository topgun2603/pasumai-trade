import { QUANTITY_UNITS, unitLabel, type QuantityUnit } from "./enums";

/**
 * Saying how much produce there is, the same way everywhere.
 *
 * ## The defect this exists to end
 *
 * The platform had three renderings of one number, often on the same screen:
 *
 *  - `{l.quantity} {l.unit}` — the raw enum, so a Tamil-reading farmer got
 *    "12000 kg" with no grouping and an English unit.
 *  - `formatQuantity(l.quantity)` — grouped, and no unit at all, which on a
 *    listing priced per kilo beside one priced per crate is not a number
 *    anybody can act on.
 *  - `formatQuantity(l.quantity) + unitLabel(l.unit)` — correct, in about a
 *    third of the places.
 *
 * A quantity without its unit is not a quantity, and a quantity with a unit
 * code rather than a unit label is a leaked implementation detail. So there is
 * one function, it always takes the unit, and the unit is not optional.
 *
 * ## Listed, available, agreed
 *
 * The other half of the same complaint is that "quantity" means three
 * different things and screens did not say which. What was put up for sale,
 * what is left after other buyers have taken some, and what a particular offer
 * covers are different numbers, and showing one where the reader expects
 * another is how somebody agrees to sell produce they have already sold.
 * `remaining` renders the pair, so the difference is on the screen rather than
 * in the reader's head.
 */

/** Indian grouping, and at most one decimal — nobody sells 12.47 kg. */
const GROUPED = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

/**
 * The unit as a word, however loosely it was typed.
 *
 * `unit` is `string` on most of the shapes these screens render, because it
 * comes out of Firestore and Firestore holds whatever was written — including
 * rows from before a unit was one of five. Casting at each of thirty call
 * sites would be a lie repeated thirty times; showing whatever is stored is
 * the honest fallback, and it degrades to the old behaviour rather than to
 * `undefined` on the screen.
 */
function label(unit: QuantityUnit | string, locale: string): string {
  return unit in QUANTITY_UNITS ? unitLabel(unit as QuantityUnit, locale) : String(unit);
}

/**
 * A quantity and its unit. The only way to render one.
 *
 * `locale` reaches the unit label, so a farmer reading Tamil sees "கிலோ". The
 * digits stay in Indian grouping either way: a farmer reads the numerals, and
 * lakh grouping is what "12,00,000" means to them.
 */
export function formatQuantity(
  value: number,
  unit: QuantityUnit | string,
  locale: string = "en",
): string {
  return `${GROUPED.format(value)} ${label(unit, locale)}`;
}

/**
 * What is left, against what there was.
 *
 * Renders "200 of 500 kg" while some has gone, and plain "500 kg" while none
 * has — because "500 of 500" is a sentence that makes a reader stop and work
 * out whether something is wrong.
 */
export function remaining(
  left: number,
  listed: number,
  unit: QuantityUnit | string,
  locale: string = "en",
): string {
  if (left >= listed) return formatQuantity(listed, unit, locale);
  return `${GROUPED.format(left)} of ${formatQuantity(listed, unit, locale)}`;
}

/**
 * A bare number, for a column that already carries its unit in the header.
 *
 * Deliberately named so it cannot be reached for by accident. A table with a
 * "Quantity (kg)" heading should not repeat the unit on every row, and that is
 * the only case this is for.
 */
export function quantityDigits(value: number): string {
  return GROUPED.format(value);
}

/**
 * Several quantities as one phrase — "500 kg + 3 crate".
 *
 * For an order spanning units. Joined with a plus rather than a comma because
 * a comma inside a number is already doing a job here.
 */
export function formatQuantities(
  totals: readonly { unit: QuantityUnit | string; quantity: number }[],
  locale: string = "en",
): string {
  if (totals.length === 0) return "—";
  return totals.map((t) => formatQuantity(t.quantity, t.unit, locale)).join(" + ");
}
