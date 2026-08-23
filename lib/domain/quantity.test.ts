import { describe, expect, it } from "vitest";

import { formatQuantity, quantityDigits, remaining } from "./quantity";

describe("showing a quantity", () => {
  /*
    Bug 7. The same number rendered three ways across listings, the
    marketplace, bargains, orders and logistics — sometimes ungrouped,
    sometimes with a raw unit code, sometimes with no unit at all.
  */
  it("groups the digits the Indian way", () => {
    expect(formatQuantity(12_000, "kg")).toBe("12,000 kg");
    expect(formatQuantity(1_200_000, "kg")).toBe("12,00,000 kg");
  });

  it("always carries the unit", () => {
    // A quantity without its unit is not a quantity — a listing priced per
    // crate beside one priced per kilo is unreadable without it.
    expect(formatQuantity(500, "crate")).toBe("500 crate");
    expect(formatQuantity(12, "tonne")).toBe("12 tonne");
  });

  it("says the unit in the reader's language", () => {
    expect(formatQuantity(500, "kg", "ta")).toBe("500 கிலோ");
    // Digits stay in Indian grouping: the numerals are what a farmer reads.
    expect(formatQuantity(1_200_000, "kg", "ta")).toBe("12,00,000 கிலோ");
  });

  it("keeps a half kilo and drops the noise below it", () => {
    expect(formatQuantity(12.5, "kg")).toBe("12.5 kg");
    expect(formatQuantity(12.46, "kg")).toBe("12.5 kg");
  });
});

describe("what is left of a lot", () => {
  it("names both numbers once some has gone", () => {
    // Bug 8: listed and available are different numbers, and a screen showing
    // one where the reader expects the other is how somebody agrees to sell
    // produce they have already sold.
    expect(remaining(200, 500, "kg")).toBe("200 of 500 kg");
  });

  it("says it plainly while the whole lot is there", () => {
    // "500 of 500" makes a reader stop and check whether something is wrong.
    expect(remaining(500, 500, "kg")).toBe("500 kg");
  });

  it("does not go odd when more is left than was listed", () => {
    // Should not happen; if it does, the listed figure is the honest one to
    // show rather than "600 of 500".
    expect(remaining(600, 500, "kg")).toBe("500 kg");
  });

  it("says nothing is left rather than hiding it", () => {
    expect(remaining(0, 500, "kg")).toBe("0 of 500 kg");
  });
});

describe("a bare number", () => {
  it("is available for a column whose header carries the unit", () => {
    expect(quantityDigits(12_000)).toBe("12,000");
  });
});

describe("a unit that is not one of the five", () => {
  it("shows what is stored rather than nothing", () => {
    /*
      `unit` is `string` on most shapes because it comes out of Firestore, and
      a row written before the list was fixed still has to render. Falling back
      to the stored word degrades to the old behaviour; the alternative is
      "500 undefined" on somebody's listing.
    */
    expect(formatQuantity(500, "sack")).toBe("500 sack");
    expect(remaining(200, 500, "sack")).toBe("200 of 500 sack");
  });
});
