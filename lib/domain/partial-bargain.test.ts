import { describe, expect, it } from "vitest";

import type { GradeQuantity } from "./listing-draft";
import type { Negotiation } from "./negotiation";
import { bidQuantity, bidValue, canBid, rank, remainingOn, type BidLine } from "./partial-bargain";

const POSTED: GradeQuantity[] = [
  { grade: "a", quantity: 400 },
  { grade: "b", quantity: 200 },
];

function thread(over: Partial<Negotiation> = {}): Negotiation {
  return {
    id: "N-1",
    listingId: "L-1",
    produceName: "Tomato",
    farmerId: "F-1",
    buyerId: "B-1",
    farmerName: "Farmer",
    buyerName: "Buyer",
    quantity: 600,
    unit: "kg",
    status: "open",
    messages: [],
    openedAt: new Date("2026-08-01T06:00:00Z"),
    ...over,
  };
}

describe("canBid", () => {
  it("takes a bid for part of what is available", () => {
    expect(canBid([{ grade: "a", quantity: 150, ratePerUnit: 2200 }], POSTED)).toEqual({
      ok: true,
    });
  });

  it("takes a bid for exactly all of it", () => {
    expect(canBid([{ grade: "a", quantity: 400, ratePerUnit: 2200 }], POSTED)).toEqual({
      ok: true,
    });
  });

  it("refuses more than is left", () => {
    expect(canBid([{ grade: "a", quantity: 401, ratePerUnit: 2200 }], POSTED)).toMatchObject({
      ok: false,
      code: "exceedsAvailable",
    });
  });

  it("says how much is actually left, so the buyer can correct it", () => {
    const result = canBid([{ grade: "b", quantity: 500, ratePerUnit: 1800 }], POSTED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("200");
  });

  it("refuses a grade the lot does not have", () => {
    expect(canBid([{ grade: "c", quantity: 10, ratePerUnit: 900 }], POSTED)).toMatchObject({
      ok: false,
      code: "notOffered",
    });
  });

  it("refuses a bid for nothing at all", () => {
    expect(canBid([{ grade: "a", quantity: 0, ratePerUnit: 2200 }], POSTED)).toMatchObject({
      ok: false,
      code: "empty",
    });
    expect(canBid([], POSTED)).toMatchObject({ ok: false, code: "empty" });
  });

  it("refuses a fraction of a unit", () => {
    expect(canBid([{ grade: "a", quantity: 12.5, ratePerUnit: 2200 }], POSTED)).toMatchObject({
      ok: false,
      code: "badQuantity",
    });
  });
});

describe("remainingOn", () => {
  it("is the whole lot when nothing has been agreed", () => {
    expect(remainingOn(POSTED, [])).toEqual(POSTED);
  });

  it("subtracts an agreed partial sale", () => {
    const sold = thread({
      status: "agreed",
      agreedBands: [{ grade: "a", ratePerUnit: 2200, quantity: 150 }],
    });

    expect(remainingOn(POSTED, [sold])).toEqual([
      { grade: "a", quantity: 250 },
      { grade: "b", quantity: 200 },
    ]);
  });

  it("subtracts several sales of the same grade", () => {
    const sales = [
      thread({
        id: "N-1",
        status: "agreed",
        agreedBands: [{ grade: "a", ratePerUnit: 2200, quantity: 150 }],
      }),
      thread({
        id: "N-2",
        status: "agreed",
        agreedBands: [{ grade: "a", ratePerUnit: 2300, quantity: 250 }],
      }),
    ];

    // Grade A is gone entirely, so it drops off rather than reading as zero.
    expect(remainingOn(POSTED, sales)).toEqual([{ grade: "b", quantity: 200 }]);
  });

  it("ignores bargains that are still open", () => {
    // Bidding reserves nothing. Two buyers may be offered the same produce; the
    // second to be accepted is the one that has to fit in what is left.
    const open = thread({
      status: "open",
      agreedBands: [{ grade: "a", ratePerUnit: 2200, quantity: 400 }],
    });

    expect(remainingOn(POSTED, [open])).toEqual(POSTED);
  });

  it("treats a band with no quantity as the whole of that grade", () => {
    // Every band written before lots could be split. Counting it as zero would
    // put sold produce back on the market.
    const legacy = thread({
      status: "agreed",
      agreedBands: [{ grade: "a", ratePerUnit: 2200 }],
    });

    expect(remainingOn(POSTED, [legacy])).toEqual([{ grade: "b", quantity: 200 }]);
  });

  it("never goes negative", () => {
    const oversold = thread({
      status: "agreed",
      agreedBands: [{ grade: "b", ratePerUnit: 1800, quantity: 900 }],
    });

    expect(remainingOn(POSTED, [oversold])).toEqual([{ grade: "a", quantity: 400 }]);
  });
});

describe("bidQuantity and bidValue", () => {
  const lines: BidLine[] = [
    { grade: "a", quantity: 100, ratePerUnit: 2200 },
    { grade: "b", quantity: 50, ratePerUnit: 1800 },
  ];

  it("adds up across grades", () => {
    expect(bidQuantity(lines)).toBe(150);
    expect(bidValue(lines)).toBe(100 * 2200 + 50 * 1800);
  });
});

describe("rank", () => {
  const lines = (rate: number, quantity: number): BidLine[] => [
    { grade: "a", quantity, ratePerUnit: rate },
  ];

  const standing = new Map<string, BidLine[]>([
    ["N-1", lines(2200, 100)],
    ["N-2", lines(2000, 300)],
  ]);

  const threads = [thread({ id: "N-1" }), thread({ id: "N-2" })];
  const lookup = (t: Negotiation) => standing.get(t.id) ?? [];

  it("marks the best price and the biggest load separately", () => {
    const result = rank(threads, lookup);
    expect(result.topBidId).toBe("N-1");
    expect(result.topQuantityId).toBe("N-2");
  });

  it("leaves the mark off a tie rather than picking a winner", () => {
    const tied = new Map<string, BidLine[]>([
      ["N-1", lines(2200, 100)],
      ["N-2", lines(2200, 100)],
    ]);
    const result = rank(threads, (t) => tied.get(t.id) ?? []);
    expect(result.topBidId).toBeUndefined();
    expect(result.topQuantityId).toBeUndefined();
  });

  it("ignores settled threads", () => {
    const result = rank(
      [thread({ id: "N-1", status: "agreed" }), thread({ id: "N-2" })],
      lookup,
    );
    expect(result.standings.map((s) => s.negotiationId)).toEqual(["N-2"]);
    expect(result.topBidId).toBe("N-2");
  });

  it("marks nothing when nobody has bid", () => {
    const result = rank(threads, () => []);
    expect(result.topBidId).toBeUndefined();
    expect(result.topQuantityId).toBeUndefined();
  });
});
