/**
 * An amount of money, held as an integer count of the currency's minor unit.
 *
 * Paise, never rupees-as-float. The platform settles real payments out of
 * escrow and a farmer will check the arithmetic by hand; floating point has no
 * place anywhere near it. The same representation goes on the wire — see
 * `contracts/logistics-api-v1.yaml`.
 *
 * Two deliberate differences from the Dart original:
 *
 * 1. `minorUnits` is **signed**. The Dart type asserted non-negative, but the
 *    ledger is append-only, so a reversal, a refund and a dispute adjustment
 *    are all negative entries. Non-negativity is checked where it genuinely
 *    applies — an offer rate, a payout instruction — not in the type.
 *
 * 2. It is a plain object, not a class. Money crosses the server/client
 *    boundary in RSC props, and class instances do not survive serialisation.
 */
export interface Money {
  readonly minorUnits: number;
  readonly currency: string;
}

export const INR = "INR";

export const ZERO: Money = { minorUnits: 0, currency: INR };

export function money(minorUnits: number, currency: string = INR): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new TypeError(
      `Money must be a whole number of minor units, got ${minorUnits}`,
    );
  }
  return { minorUnits, currency };
}

/** Convenience for whole rupees. */
export function rupees(amount: number): Money {
  return money(Math.trunc(amount * 100));
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minorUnits: a.minorUnits + b.minorUnits, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minorUnits: a.minorUnits - b.minorUnits, currency: a.currency };
}

export function negate(a: Money): Money {
  return { minorUnits: -a.minorUnits, currency: a.currency };
}

export function sum(amounts: readonly Money[]): Money {
  return amounts.reduce(add, ZERO);
}

/**
 * Rounds half away from zero, matching how a rupee amount is settled.
 *
 * `Math.round` rounds half toward positive infinity, so it disagrees with the
 * Dart original on negative halves — `Math.round(-2.5)` is `-2` where Dart's
 * `(-2.5).round()` is `-3`. That mattered nowhere while Money was unsigned and
 * matters in the ledger now that it is signed.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Rate is per-unit in minor units; quantity may be fractional (1,180.5 kg). */
export function forQuantity(ratePerUnit: number, quantity: number): Money {
  return money(roundHalfAwayFromZero(ratePerUnit * quantity));
}

export function compareMoney(a: Money, b: Money): number {
  return a.minorUnits - b.minorUnits;
}

export function isZero(a: Money): boolean {
  return a.minorUnits === 0;
}

const RUPEE_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * `₹22,800` — Indian digit grouping, no decimals.
 *
 * Paise are dropped in display because produce settles in whole rupees and a
 * farmer reading `₹22,800.00` has to scan past noise to find the number that
 * matters. `minorUnits` remains the source of truth.
 */
export function formatMoney(amount: Money): string {
  return RUPEE_FORMAT.format(amount.minorUnits / 100);
}

/** `₹19/kg` */
export function formatRate(amount: Money, unitLabel: string): string {
  return `${formatMoney(amount)}/${unitLabel}`;
}
