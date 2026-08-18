/**
 * What produce actually settled at today, and what to show when nothing has.
 *
 * The landing page has always shown a price per crop. Until now every one of
 * those figures came from `lib/mock/market` — seeded sample stock — while the
 * copy above them said "what farmers and buyers agreed on today". That is a
 * claim the page could not support: no farmer and no buyer had agreed anything
 * behind those numbers.
 *
 * So a price is drawn from real settled bargains where there are any, and the
 * sample is kept only as an illustration, marked as one. The two are never
 * blended into an average, and a real figure is never displaced by a sample —
 * a page that quietly mixes them is worse than one with no prices at all,
 * because a farmer cannot tell which kind of number they are reading.
 */

export interface SettledSale {
  readonly produceId: string;
  /** Per listed unit, in minor units. `1900` is ₹19/kg. */
  readonly ratePerUnit: number;
  readonly unit: string;
  readonly agreedAt: Date;
  /** The village it is collected from, for counting how spread the trade is. */
  readonly placeId?: string;
}

export interface PriceQuote {
  readonly produceId: string;
  readonly ratePerUnit: number;
  readonly unit: string;
  /** Separate bargains behind this figure. */
  readonly settledCount: number;
  /** Distinct villages it settled in. */
  readonly sources: number;
  readonly latestAt: Date;
}

/**
 * How far back "today" reaches.
 *
 * A rolling day rather than since midnight. A bargain struck at eleven last
 * night is the freshest thing the platform knows at seven this morning, and
 * blanking the page until the first sale of the calendar day would replace a
 * real price with an illustration for no reason a farmer would recognise.
 */
export const WINDOW_HOURS = 24;

/**
 * The middle of what settled, not the average.
 *
 * One unusual lot — a distress sale, a tiny premium consignment — moves a mean
 * far enough to mislead, and these figures are read by farmers deciding what to
 * ask for. The median moves only when the middle of the market moves.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** Sales struck within the window, newest first. */
export function withinWindow(
  sales: readonly SettledSale[],
  now: number,
  windowHours: number = WINDOW_HOURS,
): SettledSale[] {
  const oldest = now - windowHours * 3_600_000;
  return sales
    .filter((sale) => {
      const at = sale.agreedAt.getTime();
      // A sale stamped in the future is a clock problem, not a price. It would
      // otherwise sit at the top of every list for as long as the skew lasts.
      return at <= now && at >= oldest;
    })
    .sort((a, b) => b.agreedAt.getTime() - a.agreedAt.getTime());
}

/**
 * One figure per crop, from the bargains behind it.
 *
 * Grouped by unit as well as crop before anything is averaged. Tomato sold by
 * the kilo and tomato sold by the crate are two different numbers, and a median
 * across both is a number that describes neither. Where a crop settled in more
 * than one unit the busiest wins, because that is the one most readers are
 * asking about; the rest are dropped rather than converted, since the pack size
 * that would make the conversion honest is not recorded on the bargain.
 */
export function quotesFrom(
  sales: readonly SettledSale[],
  now: number,
  windowHours: number = WINDOW_HOURS,
): PriceQuote[] {
  const recent = withinWindow(sales, now, windowHours);

  const byProduceAndUnit = new Map<string, SettledSale[]>();
  for (const sale of recent) {
    const key = `${sale.produceId}\u0000${sale.unit}`;
    const group = byProduceAndUnit.get(key) ?? [];
    group.push(sale);
    byProduceAndUnit.set(key, group);
  }

  const best = new Map<string, SettledSale[]>();
  for (const group of byProduceAndUnit.values()) {
    const produceId = group[0].produceId;
    const held = best.get(produceId);
    // Busiest unit wins; a tie goes to whichever settled most recently, which
    // `withinWindow` has already put first.
    if (!held || group.length > held.length) best.set(produceId, group);
  }

  return [...best.values()]
    .map((group) => ({
      produceId: group[0].produceId,
      unit: group[0].unit,
      ratePerUnit: median(group.map((sale) => sale.ratePerUnit)),
      settledCount: group.length,
      sources: new Set(group.map((sale) => sale.placeId).filter(Boolean)).size,
      latestAt: group[0].agreedAt,
    }))
    .sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}

export interface ShownPrice {
  readonly quote: PriceQuote;
  /**
   * A sample, not a bargain anybody struck.
   *
   * Carried per line rather than per page, because the honest state is usually
   * mixed: tomato settled four times today and turmeric has not been traded
   * this week. Saying "some of these are examples" leaves the reader to guess
   * which, and the one they guess wrong about is the one they act on.
   */
  readonly illustrative: boolean;
}

/**
 * Real prices first, samples only to fill the gap.
 *
 * A crop that settled today never also appears as a sample, and no sample ever
 * pushes a real figure off the page. `target` is how many cards the section
 * wants to show; the samples stop once it is reached, or once they run out.
 */
export function preferLive(
  live: readonly PriceQuote[],
  template: readonly PriceQuote[],
  target: number,
): ShownPrice[] {
  const shown: ShownPrice[] = live.map((quote) => ({ quote, illustrative: false }));
  const covered = new Set(live.map((quote) => quote.produceId));

  for (const quote of template) {
    if (shown.length >= target) break;
    if (covered.has(quote.produceId)) continue;
    covered.add(quote.produceId);
    shown.push({ quote, illustrative: true });
  }

  return shown;
}
