import { describe, expect, it } from "vitest";

import { cropsIn, priceHistory, salesFrom, summarise, trend } from "./farm-analytics";
import type { Negotiation } from "./negotiation";

const DAY = 86_400_000;
const NOW = new Date("2026-08-16T09:00:00+05:30");

function thread(over: Partial<Negotiation> = {}): Negotiation {
  return {
    id: "N-1",
    listingId: "L-1",
    produceName: "Tomato",
    farmerId: "F-201",
    buyerId: "B-1001",
    farmerName: "R. Murugan",
    buyerName: "Kongu Agri",
    quantity: 800,
    unit: "kg",
    status: "agreed",
    messages: [],
    openedAt: NOW,
    agreedAt: NOW,
    agreedBands: [{ grade: "a", ratePerUnit: 2600 }],
    ...over,
  };
}

describe("what counts as a sale", () => {
  it("takes only agreed bargains", () => {
    const threads = [
      thread({ id: "N-1" }),
      thread({ id: "N-2", status: "withdrawn" }),
      thread({ id: "N-3", status: "expired" }),
      thread({ id: "N-4", status: "open", agreedBands: undefined }),
    ];
    expect(salesFrom(threads).map((s) => s.id)).toEqual(["N-1-a"]);
  });

  it("skips an agreed bargain with no bands, rather than inventing a price", () => {
    expect(salesFrom([thread({ agreedBands: [] })])).toEqual([]);
  });

  it("splits one bargain into a line per grade", () => {
    const sales = salesFrom([
      thread({
        agreedBands: [
          { grade: "a", ratePerUnit: 2600 },
          { grade: "b", ratePerUnit: 1800 },
        ],
      }),
    ]);
    expect(sales.map((s) => s.grade).sort()).toEqual(["a", "b"]);
    // A bargain records one quantity for the lot, so two grades divide it.
    expect(sales.every((s) => s.quantity === 400)).toBe(true);
    // And says so, because the value column is an estimate when it happens.
    expect(sales.every((s) => s.apportioned)).toBe(true);
  });

  it("does not mark a single-grade sale as apportioned", () => {
    expect(salesFrom([thread()])[0].apportioned).toBe(false);
  });

  it("values a line at rate times quantity", () => {
    // ₹26 × 800 kg = ₹20,800.
    expect(salesFrom([thread()])[0].value.minorUnits).toBe(2600 * 800);
  });

  it("puts the newest first", () => {
    const sales = salesFrom([
      thread({ id: "old", agreedAt: new Date(NOW.getTime() - 10 * DAY) }),
      thread({ id: "new", agreedAt: NOW }),
    ]);
    expect(sales[0].id.startsWith("new")).toBe(true);
  });
});

describe("summary", () => {
  it("weights the average by quantity, not by sale count", () => {
    // A 900 kg sale at ₹20 and a 100 kg sale at ₹40 average ₹22, not ₹30.
    const sales = salesFrom([
      thread({ id: "N-1", quantity: 900, agreedBands: [{ grade: "a", ratePerUnit: 2000 }] }),
      thread({ id: "N-2", quantity: 100, agreedBands: [{ grade: "a", ratePerUnit: 4000 }] }),
    ]);
    expect(summarise(sales).byGrade.find((g) => g.grade === "a")?.rate).toBe(2200);
  });

  it("totals what was earned", () => {
    const sales = salesFrom([
      thread({ id: "N-1", quantity: 100, agreedBands: [{ grade: "a", ratePerUnit: 2000 }] }),
      thread({ id: "N-2", quantity: 50, agreedBands: [{ grade: "b", ratePerUnit: 1000 }] }),
    ]);
    expect(summarise(sales).earned.minorUnits).toBe(2000 * 100 + 1000 * 50);
  });

  it("reports nothing rather than zero for a grade never sold", () => {
    const summary = summarise(salesFrom([thread()]));
    expect(summary.byGrade.map((g) => g.grade)).toEqual(["a"]);
  });

  it("survives an empty set", () => {
    const summary = summarise([]);
    expect(summary).toMatchObject({ sales: 0, lots: 0, quantity: 0 });
    expect(summary.earned.minorUnits).toBe(0);
    expect(summary.byGrade).toEqual([]);
  });

  it("finds the best rate achieved", () => {
    const sales = salesFrom([
      thread({ id: "N-1", agreedBands: [{ grade: "a", ratePerUnit: 2000 }] }),
      thread({ id: "N-2", agreedBands: [{ grade: "a", ratePerUnit: 3100 }] }),
    ]);
    expect(summarise(sales).bestRate?.ratePerUnit).toBe(3100);
  });
});

describe("price history", () => {
  it("plots rupees, because a person reads the axis", () => {
    // 2600 paise is ₹26 on the chart.
    expect(priceHistory(salesFrom([thread()]))[0].a).toBe(26);
  });

  it("leaves a day with no sale absent rather than zero", () => {
    const points = priceHistory(
      salesFrom([
        thread({ id: "N-1", agreedBands: [{ grade: "a", ratePerUnit: 2600 }] }),
        thread({ id: "N-2", agreedBands: [{ grade: "b", ratePerUnit: 1800 }] }),
      ]),
    );
    // Same day, so one point carrying both — and never a `c` of zero, which
    // would draw a collapse in a price nobody traded.
    expect(points).toHaveLength(1);
    expect(points[0].c).toBeUndefined();
  });

  it("orders oldest to newest, the way a chart reads", () => {
    const points = priceHistory(
      salesFrom([
        thread({ id: "N-1", agreedAt: new Date(NOW.getTime() - 3 * DAY) }),
        thread({ id: "N-2", agreedAt: NOW }),
      ]),
    );
    expect(points.map((p) => p.day)).toEqual([...points.map((p) => p.day)].sort());
  });

  it("averages several sales on the same day", () => {
    const points = priceHistory(
      salesFrom([
        thread({ id: "N-1", agreedBands: [{ grade: "a", ratePerUnit: 2000 }] }),
        thread({ id: "N-2", agreedBands: [{ grade: "a", ratePerUnit: 3000 }] }),
      ]),
    );
    expect(points[0].a).toBe(25);
  });
});

describe("trend", () => {
  it("compares the latest sale against the ones before it", () => {
    const sales = salesFrom([
      thread({ id: "N-1", agreedAt: new Date(NOW.getTime() - 5 * DAY), agreedBands: [{ grade: "a", ratePerUnit: 2000 }] }),
      thread({ id: "N-2", agreedAt: NOW, agreedBands: [{ grade: "a", ratePerUnit: 2400 }] }),
    ]);
    expect(trend(sales, "a")).toMatchObject({ latest: 2400, previous: 2000, changePercent: 20 });
  });

  it("says nothing when there is nothing to compare", () => {
    expect(trend(salesFrom([thread()]), "a")).toBeNull();
    expect(trend(salesFrom([thread()]), "c")).toBeNull();
  });
});

describe("crops", () => {
  it("lists them once, sorted", () => {
    const sales = salesFrom([
      thread({ id: "N-1", produceName: "Tomato" }),
      thread({ id: "N-2", produceName: "Banana" }),
      thread({ id: "N-3", produceName: "Tomato" }),
    ]);
    expect(cropsIn(sales)).toEqual(["Banana", "Tomato"]);
  });
});
