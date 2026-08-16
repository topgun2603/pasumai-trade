import type { Grade } from "./enums";
import { GRADES } from "./enums";
import { forQuantity, money, type Money } from "./money";
import type { Negotiation } from "./negotiation";

/**
 * What a farmer's own trade looks like, from their settled bargains.
 *
 * The point of this page is one question asked in several ways: *what is my
 * crop actually worth?* A farmer who can answer that from their own history
 * negotiates from evidence instead of from the first number a buyer says, and
 * that is the whole argument for the platform.
 *
 * Everything here is derived from agreed negotiations. Nothing is stored: a
 * cached average is an average that disagrees with the sales under it the
 * first time one is corrected, and the volumes involved — a few hundred sales
 * over a season — do not justify the risk.
 */

export interface Sale {
  readonly id: string;
  readonly produceName: string;
  readonly buyerName: string;
  readonly grade: Grade;
  /** Paise per unit, as agreed. */
  readonly ratePerUnit: number;
  /**
   * Units at that grade.
   *
   * A bargain records one quantity for the lot, not a split per grade, so a
   * two-grade settlement divides it. Stated rather than hidden: the value
   * column is an estimate wherever a bargain settled more than one grade, and
   * it becomes exact once grading at pickup is recorded against the order.
   */
  readonly quantity: number;
  readonly unit: string;
  readonly value: Money;
  readonly settledAt: Date;
  /** True when the quantity was divided across grades rather than measured. */
  readonly apportioned: boolean;
}

/** Every settled grade-line, newest first. One bargain can produce three. */
export function salesFrom(threads: readonly Negotiation[]): Sale[] {
  const sales: Sale[] = [];

  for (const thread of threads) {
    if (thread.status !== "agreed" || !thread.agreedBands?.length) continue;

    const bands = thread.agreedBands;
    const apportioned = bands.length > 1;
    // Split evenly across the grades that settled. Wrong in detail, right in
    // aggregate, and the alternative is showing nothing at all.
    const share = thread.quantity / bands.length;

    for (const band of bands) {
      sales.push({
        id: `${thread.id}-${band.grade}`,
        produceName: thread.produceName,
        buyerName: thread.buyerName,
        grade: band.grade,
        ratePerUnit: band.ratePerUnit,
        quantity: Math.round(share),
        unit: thread.unit,
        value: forQuantity(band.ratePerUnit, Math.round(share)),
        settledAt: thread.agreedAt ?? thread.openedAt,
        apportioned,
      });
    }
  }

  return sales.sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime());
}

/* -------------------------------------------------------------------------
   Totals
   ------------------------------------------------------------------------- */

export interface FarmTotalsSummary {
  readonly sales: number;
  readonly lots: number;
  readonly earned: Money;
  readonly quantity: number;
  readonly unit: string;
  /** Average rate per unit, weighted by quantity, per grade. */
  readonly byGrade: Array<{ grade: Grade; rate: number; quantity: number }>;
  readonly bestRate?: Sale;
}

/**
 * Weighted, not a plain mean.
 *
 * Averaging the rates of a 900 kg sale and a 20 kg sale as equals would make a
 * small odd lot move the number as much as the harvest did, and a farmer
 * checking "what does my grade A go for" would be told something untrue.
 */
export function summarise(sales: readonly Sale[]): FarmTotalsSummary {
  const byGrade = GRADES.flatMap((grade) => {
    const rows = sales.filter((s) => s.grade === grade);
    if (rows.length === 0) return [];
    const quantity = rows.reduce((sum, s) => sum + s.quantity, 0);
    if (quantity === 0) return [];
    const weighted = rows.reduce((sum, s) => sum + s.ratePerUnit * s.quantity, 0);
    return [{ grade, rate: Math.round(weighted / quantity), quantity }];
  });

  return {
    sales: sales.length,
    lots: new Set(sales.map((s) => s.id.split("-").slice(0, -1).join("-"))).size,
    earned: money(sales.reduce((sum, s) => sum + s.value.minorUnits, 0)),
    quantity: sales.reduce((sum, s) => sum + s.quantity, 0),
    unit: sales[0]?.unit ?? "kg",
    byGrade,
    bestRate: [...sales].sort((a, b) => b.ratePerUnit - a.ratePerUnit)[0],
  };
}

/* -------------------------------------------------------------------------
   History
   ------------------------------------------------------------------------- */

export interface PricePoint {
  /** ISO day, so the chart's x-axis sorts as a string. */
  readonly day: string;
  readonly label: string;
  readonly a?: number;
  readonly b?: number;
  readonly c?: number;
}

/**
 * Settled rates over time, in rupees, one series per grade.
 *
 * Rupees rather than paise because this feeds an axis a person reads, and an
 * axis labelled 260000 for ₹2,600 is an axis nobody trusts. Every other number
 * in the codebase stays in paise.
 *
 * Days with no sale are absent rather than zero: a zero would draw the line to
 * the floor and read as a collapse in price, when it means nobody sold that
 * day.
 */
export function priceHistory(sales: readonly Sale[]): PricePoint[] {
  const days = new Map<string, { a: number[]; b: number[]; c: number[]; at: Date }>();

  for (const sale of sales) {
    const day = sale.settledAt.toISOString().slice(0, 10);
    const entry = days.get(day) ?? { a: [], b: [], c: [], at: sale.settledAt };
    entry[sale.grade].push(sale.ratePerUnit);
    days.set(day, entry);
  }

  const mean = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) / 100 : undefined;

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, entry]) => ({
      day,
      label: entry.at.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      a: mean(entry.a),
      b: mean(entry.b),
      c: mean(entry.c),
    }));
}

/** Distinct crops in the set, for the filter. */
export function cropsIn(sales: readonly Sale[]): string[] {
  return [...new Set(sales.map((s) => s.produceName))].sort();
}

/**
 * How the last sale compares with what came before it, per grade.
 *
 * The number a farmer is actually after: not "what is the average" but "am I
 * being offered less than last time". Positive means the most recent settled
 * rate beat the average of the earlier ones.
 */
export function trend(
  sales: readonly Sale[],
  grade: Grade,
): { latest: number; previous: number; changePercent: number } | null {
  const rows = sales
    .filter((s) => s.grade === grade)
    .sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime());

  if (rows.length < 2) return null;

  const [latest, ...earlier] = rows;
  const previous = Math.round(
    earlier.reduce((sum, s) => sum + s.ratePerUnit, 0) / earlier.length,
  );
  if (previous === 0) return null;

  return {
    latest: latest.ratePerUnit,
    previous,
    changePercent: Math.round(((latest.ratePerUnit - previous) / previous) * 100),
  };
}
