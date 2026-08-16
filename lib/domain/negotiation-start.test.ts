import { describe, expect, it } from "vitest";

import { canStart, openingBands, startNegotiation, type ListingForBargain } from "./negotiation-start";
import type { Negotiation } from "./negotiation";

const NOW = new Date("2026-08-16T09:00:00+05:30");

function listing(over: Partial<ListingForBargain> = {}): ListingForBargain {
  return {
    id: "L-1",
    produceName: "Tomato",
    farmerId: "F-201",
    farmerName: "R. Murugan",
    quantity: 800,
    unit: "kg",
    status: "awaitingOffer",
    grades: [
      { grade: "a", quantity: 500, askingRate: 2600 },
      { grade: "b", quantity: 300 },
    ],
    ...over,
  };
}

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
    status: "open",
    messages: [],
    openedAt: NOW,
    ...over,
  };
}

describe("opening a bargain", () => {
  it("allows a buyer with no thread on the lot", () => {
    expect(canStart({ listing: listing(), buyerId: "B-1001", existing: [] })).toEqual({ ok: true });
  });

  it("refuses a second thread on the same lot", () => {
    // Two threads means two prices agreed for produce that exists once.
    expect(
      canStart({ listing: listing(), buyerId: "B-1001", existing: [thread()] }),
    ).toMatchObject({ ok: false, code: "alreadyOpen" });
  });

  it("allows a new one once the last finished", () => {
    for (const status of ["agreed", "withdrawn", "expired"] as const) {
      expect(
        canStart({ listing: listing(), buyerId: "B-1001", existing: [thread({ status })] }),
      ).toEqual({ ok: true });
    }
  });

  it("does not count another buyer's thread against this one", () => {
    // Several buyers bargaining for the same lot is the market working.
    expect(
      canStart({
        listing: listing(),
        buyerId: "B-2002",
        existing: [thread({ buyerId: "B-1001" })],
      }),
    ).toEqual({ ok: true });
  });

  it("does not count a thread on a different lot", () => {
    expect(
      canStart({
        listing: listing({ id: "L-2" }),
        buyerId: "B-1001",
        existing: [thread({ listingId: "L-1" })],
      }),
    ).toEqual({ ok: true });
  });

  it("refuses a withdrawn or expired listing", () => {
    for (const status of ["withdrawn", "expired"] as const) {
      expect(
        canStart({ listing: listing({ status }), buyerId: "B-1001", existing: [] }),
      ).toMatchObject({ ok: false, code: "listingClosed" });
    }
  });

  it("refuses bargaining with yourself", () => {
    // A farmer holding a buyer account would otherwise settle a price against
    // nobody and put a real order behind it.
    expect(
      canStart({ listing: listing(), buyerId: "F-201", existing: [] }),
    ).toMatchObject({ ok: false, code: "ownListing" });
  });
});

describe("the thread it creates", () => {
  it("opens empty, with no price", () => {
    const started = startNegotiation({
      id: "N-9",
      listing: listing(),
      buyerId: "B-1001",
      buyerName: "Kongu Agri",
      now: NOW,
    });
    expect(started).toMatchObject({ status: "open", messages: [] });
    expect(started.agreedBands).toBeUndefined();
  });

  it("carries the farmer and the lot from the listing, not the request", () => {
    const started = startNegotiation({
      id: "N-9",
      listing: listing(),
      buyerId: "B-1001",
      buyerName: "Kongu Agri",
      now: NOW,
    });
    expect(started).toMatchObject({
      farmerId: "F-201",
      farmerName: "R. Murugan",
      listingId: "L-1",
      quantity: 800,
    });
  });
});

describe("the opening offer", () => {
  it("starts from what the farmer is asking", () => {
    expect(openingBands(listing().grades)).toEqual([
      { grade: "a", ratePerUnit: 2600 },
      // No ask on B, so nothing suggested — guessing on the farmer's behalf
      // would set the anchor from the platform rather than from either party.
      { grade: "b", ratePerUnit: undefined },
    ]);
  });
});
