import { describe, expect, it } from "vitest";

import type { QuantityUnit } from "./enums";
import { orderQuantities, orderQuantity, type BuyerOrder, type OrderLine } from "./orders";

function line(over: { unit: QuantityUnit; quantity: number }): OrderLine {
  return {
    produceId: "onion",
    produceName: "Onion",
    emoji: "🧅",
    grade: "a",
    unitPrice: 2200,
    ...over,
  };
}

function buyerOrder(over: { lines: OrderLine[] }): BuyerOrder {
  return {
    id: "O-1",
    reference: "PT-0001",
    status: "paid",
    placedAt: new Date("2026-08-20T06:00:00+05:30"),
    buyerName: "Kongu Fresh",
    districtId: "tiruppur",
    district: "Tiruppur",
    stops: ["Avinashi"],
    distanceKm: 18,
    ...over,
  };
}

describe("how much an order is for", () => {
  /*
    Bug 7. `orderQuantity` adds the line quantities together, which is only a
    number when every line shares a unit — an order for 500 kg of onion and 3
    crates of tomato summed to 503, and 503 of nothing was printed on the
    orders table as the total.
  */
  it("keeps a single-unit order as one figure", () => {
    const order = buyerOrder({
      lines: [line({ unit: "kg", quantity: 300 }), line({ unit: "kg", quantity: 200 })],
    });
    expect(orderQuantities(order)).toEqual([{ unit: "kg", quantity: 500 }]);
  });

  it("refuses to add kilos to crates", () => {
    const order = buyerOrder({
      lines: [line({ unit: "kg", quantity: 500 }), line({ unit: "crate", quantity: 3 })],
    });

    expect(orderQuantities(order)).toEqual([
      { unit: "kg", quantity: 500 },
      { unit: "crate", quantity: 3 },
    ]);

    // The old figure, kept visible so the difference is legible rather than
    // being a number nobody can trace. Still fine for sorting a column by
    // rough magnitude, which is all it is used for now.
    expect(orderQuantity(order)).toBe(503);
  });

  it("keeps the order the lines came in", () => {
    const order = buyerOrder({
      lines: [
        line({ unit: "crate", quantity: 2 }),
        line({ unit: "kg", quantity: 100 }),
        line({ unit: "crate", quantity: 1 }),
      ],
    });

    expect(orderQuantities(order).map((t) => t.unit)).toEqual(["crate", "kg"]);
    expect(orderQuantities(order)[0].quantity).toBe(3);
  });

  it("has nothing to say about an empty order", () => {
    expect(orderQuantities(buyerOrder({ lines: [] }))).toEqual([]);
  });
});
