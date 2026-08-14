import { describe, expect, it } from "vitest";

import {
  add,
  compareMoney,
  forQuantity,
  formatMoney,
  formatRate,
  money,
  negate,
  roundHalfAwayFromZero,
  rupees,
  subtract,
  sum,
  ZERO,
} from "./money";

describe("money", () => {
  it("holds paise, not rupees", () => {
    expect(rupees(19).minorUnits).toBe(1900);
    expect(money(1900).minorUnits).toBe(1900);
  });

  it("rejects fractional minor units", () => {
    // A fraction of a paisa is a rounding bug that has escaped somewhere
    // upstream; better to fail loudly than to silently truncate money.
    expect(() => money(1900.5)).toThrow(TypeError);
  });

  it("refuses to combine different currencies", () => {
    expect(() => add(money(100), money(100, "USD"))).toThrow(TypeError);
  });

  it("is signed, because the ledger needs reversals", () => {
    const reversal = negate(rupees(500));
    expect(reversal.minorUnits).toBe(-50_000);
    expect(add(rupees(500), reversal)).toEqual(ZERO);
  });

  it("subtracts past zero rather than clamping", () => {
    expect(subtract(rupees(100), rupees(250)).minorUnits).toBe(-15_000);
  });

  it("sums an empty list to zero", () => {
    expect(sum([])).toEqual(ZERO);
  });

  it("sums a list", () => {
    expect(sum([rupees(10), rupees(20), rupees(30)]).minorUnits).toBe(6000);
  });

  it("compares by value", () => {
    expect(compareMoney(rupees(10), rupees(20))).toBeLessThan(0);
    expect(compareMoney(rupees(20), rupees(10))).toBeGreaterThan(0);
    expect(compareMoney(rupees(10), rupees(10))).toBe(0);
  });
});

describe("roundHalfAwayFromZero", () => {
  it("rounds positive halves up", () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
  });

  it("rounds negative halves away from zero, unlike Math.round", () => {
    // This is the whole reason the helper exists. Math.round(-2.5) is -2,
    // which disagrees with how a rupee amount settles and with the Dart
    // original the domain was ported from.
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(Math.round(-2.5)).toBe(-2);
  });

  it("leaves whole numbers alone", () => {
    expect(roundHalfAwayFromZero(7)).toBe(7);
    expect(roundHalfAwayFromZero(-7)).toBe(-7);
  });
});

describe("forQuantity", () => {
  it("multiplies a rate by a fractional quantity", () => {
    // ₹19/kg over 1,180.5 kg
    expect(forQuantity(1900, 1180.5).minorUnits).toBe(2_242_950);
  });

  it("always yields whole minor units", () => {
    const result = forQuantity(1933, 7.77);
    expect(Number.isInteger(result.minorUnits)).toBe(true);
  });

  it("rounds a half away from zero", () => {
    // 1.5 paise must settle at 2, not 1.
    expect(forQuantity(3, 0.5).minorUnits).toBe(2);
  });

  it("handles a negative rate for a reversal", () => {
    expect(forQuantity(-1900, 10).minorUnits).toBe(-19_000);
  });
});

describe("formatting", () => {
  it("uses Indian digit grouping with no decimals", () => {
    // 22,800 rupees — lakh grouping, not thousands.
    expect(formatMoney(rupees(22_800))).toBe("₹22,800");
    expect(formatMoney(rupees(2_000_000))).toBe("₹20,00,000");
  });

  it("drops paise in display while keeping them in the value", () => {
    const amount = money(2_280_050);
    expect(formatMoney(amount)).toBe("₹22,801");
    expect(amount.minorUnits).toBe(2_280_050);
  });

  it("formats a rate with its unit", () => {
    expect(formatRate(money(1900), "kg")).toBe("₹19/kg");
  });

  it("formats zero", () => {
    expect(formatMoney(ZERO)).toBe("₹0");
  });
});
