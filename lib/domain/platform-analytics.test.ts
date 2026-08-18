import { describe, expect, it } from "vitest";

import {
  accountMix,
  activityByDay,
  hoursToSettle,
  outcomes,
  real,
  settledRates,
  supplyByCrop,
  supplyByDistrict,
  type BargainFact,
  type ListingFact,
} from "./platform-analytics";

const NOW = new Date("2026-08-18T12:00:00Z").getTime();
const DAY = 86_400_000;

function listing(over: Partial<ListingFact> = {}): ListingFact {
  return {
    id: "L-1",
    produceName: "Tomato",
    district: "Erode",
    quantity: 100,
    unit: "kg",
    status: "awaitingOffer",
    createdAt: new Date(NOW),
    seeded: false,
    ...over,
  };
}

function bargain(over: Partial<BargainFact> = {}): BargainFact {
  return {
    id: "N-1",
    produceName: "Tomato",
    status: "agreed",
    openedAt: new Date(NOW - 3 * 3_600_000),
    agreedAt: new Date(NOW),
    unit: "kg",
    rates: [{ grade: "a", ratePerUnit: 2400 }],
    ...over,
  };
}

describe("what counts as evidence", () => {
  it("drops the demo rows", () => {
    // A seeded listing is a thing the platform wrote about itself. It is not
    // evidence about the platform.
    const rows = real([listing({ id: "a" }), listing({ id: "b", seeded: true })]);
    expect(rows.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("supply", () => {
  it("adds quantities only within one unit", () => {
    // 800 kg and 2 crates add to neither 802 nor anything else.
    const rows = supplyByCrop([
      listing({ id: "a", quantity: 400 }),
      listing({ id: "b", quantity: 400 }),
      listing({ id: "c", quantity: 2, unit: "crate" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ unit: "kg", quantity: 800, listings: 2, mixedUnits: true });
  });

  it("says nothing about mixed units when there are none", () => {
    expect(supplyByCrop([listing()])[0].mixedUnits).toBe(false);
  });

  it("ranks crops by quantity", () => {
    const rows = supplyByCrop([
      listing({ id: "a", produceName: "Onion", quantity: 50 }),
      listing({ id: "b", produceName: "Tomato", quantity: 500 }),
    ]);
    expect(rows.map((r) => r.produceName)).toEqual(["Tomato", "Onion"]);
  });

  it("names a district nobody recorded rather than dropping the listing", () => {
    const rows = supplyByDistrict([listing({ district: "" })]);
    expect(rows[0].district).toBe("Not recorded");
    expect(rows[0].listings).toBe(1);
  });

  it("counts distinct crops per district", () => {
    const rows = supplyByDistrict([
      listing({ id: "a", produceName: "Tomato" }),
      listing({ id: "b", produceName: "Tomato" }),
      listing({ id: "c", produceName: "Onion" }),
    ]);
    expect(rows[0]).toMatchObject({ listings: 3, crops: 2 });
  });
});

describe("how bargains end", () => {
  it("measures the agreed share against finished bargains only", () => {
    // Counting open ones would make the platform look worse every time
    // somebody starts a conversation.
    const result = outcomes([
      bargain({ id: "1", status: "agreed" }),
      bargain({ id: "2", status: "declined" }),
      bargain({ id: "3", status: "open" }),
    ]);
    expect(result).toMatchObject({ open: 1, agreed: 1, ended: 1, agreedShare: 50 });
  });

  it("has no share to report before anything has finished", () => {
    expect(outcomes([bargain({ status: "open" })]).agreedShare).toBeNull();
  });

  it("has nothing to report about nothing", () => {
    expect(outcomes([])).toMatchObject({ open: 0, agreed: 0, ended: 0, agreedShare: null });
  });
});

describe("what settled at what", () => {
  it("takes the middle of each crop and grade", () => {
    const rows = settledRates([
      bargain({ id: "1", rates: [{ grade: "a", ratePerUnit: 2000 }] }),
      bargain({ id: "2", rates: [{ grade: "a", ratePerUnit: 2400 }] }),
      bargain({ id: "3", rates: [{ grade: "a", ratePerUnit: 3000 }] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ grade: "a", ratePerUnit: 2400, agreements: 3 });
  });

  it("keeps grades apart", () => {
    const rows = settledRates([
      bargain({ rates: [{ grade: "a", ratePerUnit: 2400 }, { grade: "b", ratePerUnit: 1900 }] }),
    ]);
    expect(rows.map((r) => r.grade)).toEqual(["a", "b"]);
  });

  it("ignores bargains that never settled", () => {
    expect(settledRates([bargain({ status: "open", rates: [] })])).toEqual([]);
  });

  it("ignores a zero rate rather than averaging it in", () => {
    const rows = settledRates([
      bargain({ id: "1", rates: [{ grade: "a", ratePerUnit: 0 }] }),
      bargain({ id: "2", rates: [{ grade: "a", ratePerUnit: 2000 }] }),
    ]);
    expect(rows[0]).toMatchObject({ ratePerUnit: 2000, agreements: 1 });
  });
});

describe("how long a bargain takes", () => {
  it("reports the median in hours", () => {
    expect(hoursToSettle([bargain()])).toBe(3);
  });

  it("reports nothing rather than zero when nothing has settled", () => {
    // Zero is a real answer meaning "instantly". A dashboard printing it
    // because it has no data is one nobody can trust the rest of.
    expect(hoursToSettle([bargain({ status: "open", agreedAt: undefined })])).toBeNull();
    expect(hoursToSettle([])).toBeNull();
  });
});

describe("accounts", () => {
  it("counts every kind even when there are none of it", () => {
    const mix = accountMix([{ kind: "farmer", status: "verified" }]);
    expect(mix.map((m) => m.kind)).toEqual(["farmer", "buyer", "agency"]);
    expect(mix[1]).toMatchObject({ total: 0, verified: 0, waiting: 0 });
  });

  it("treats anything not verified and not refused as still waiting", () => {
    const mix = accountMix([
      { kind: "farmer", status: "verified" },
      { kind: "farmer", status: "pending" },
      { kind: "farmer", status: "somethingElse" },
      { kind: "farmer", status: "rejected" },
    ]);
    expect(mix[0]).toMatchObject({ total: 4, verified: 1, waiting: 2 });
  });
});

describe("activity over time", () => {
  it("includes the days nothing happened on", () => {
    // A chart built only from busy days draws a smooth line through a
    // fortnight of silence and reads as steady trade.
    const points = activityByDay([listing()], [], NOW, 7);
    expect(points).toHaveLength(7);
    expect(points.filter((p) => p.listings === 0)).toHaveLength(6);
  });

  it("ends on today", () => {
    const points = activityByDay([], [], NOW, 3);
    expect(points.at(-1)?.day).toBe("2026-08-18");
  });

  it("counts listings and bargains separately", () => {
    const points = activityByDay(
      [listing({ createdAt: new Date(NOW - DAY) })],
      [bargain({ openedAt: new Date(NOW) })],
      NOW,
      3,
    );
    expect(points.at(-2)).toMatchObject({ listings: 1, bargains: 0 });
    expect(points.at(-1)).toMatchObject({ listings: 0, bargains: 1 });
  });
});
