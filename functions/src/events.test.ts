import { describe, expect, it } from "vitest";

import { forBargain, forListing, forOrder } from "./events";

/**
 * Who gets told what.
 *
 * These are the rules the triggers exist to apply, and the reason they live in
 * a pure module: a mistake here is a farmer not hearing that their produce
 * sold, or a buyer hearing about a lot four districts away.
 */

const LISTING = {
  produceName: "Tomato",
  quantity: 600,
  unit: "kg",
  farmerId: "F-1",
  status: "awaitingOffer",
};

function thread(over: Record<string, unknown> = {}) {
  return {
    farmerId: "F-1",
    buyerId: "B-1",
    farmerName: "R. Murugan",
    buyerName: "Kongu Agri",
    produceName: "Tomato",
    quantity: 600,
    unit: "kg",
    status: "open",
    messages: [],
    ...over,
  };
}

const message = (author: string, kind: string) => ({ author, kind });

describe("new produce", () => {
  it("tells every buyer covering the district", () => {
    const drafts = forListing({
      listing: LISTING,
      listingId: "L-1",
      farmerName: "R. Murugan",
      buyerIds: ["B-1", "B-2"],
    });

    expect(drafts.map((d) => d.accountId)).toEqual(["B-1", "B-2"]);
    expect(drafts.at(0)).toMatchObject({
      audience: "buyer",
      kind: "produceListed",
      href: "/listings",
      subject: { produceName: "Tomato", quantity: 600, counterparty: "R. Murugan" },
    });
  });

  it("tells nobody about a seeded demo row", () => {
    // Telling real buyers about sample data is the platform lying about its
    // own market.
    expect(
      forListing({
        listing: { ...LISTING, seeded: true },
        listingId: "L-1",
        farmerName: "R. Murugan",
        buyerIds: ["B-1"],
      }),
    ).toEqual([]);
  });

  it("tells nobody about a lot that is already off the market", () => {
    for (const status of ["withdrawn", "expired"]) {
      expect(
        forListing({
          listing: { ...LISTING, status },
          listingId: "L-1",
          farmerName: "R. Murugan",
          buyerIds: ["B-1"],
        }),
      ).toEqual([]);
    }
  });

  it("names the farmer even when their record has no name", () => {
    const drafts = forListing({
      listing: LISTING,
      listingId: "L-1",
      farmerName: "",
      buyerIds: ["B-1"],
    });
    expect(drafts.at(0)?.subject.counterparty).toBe("A farmer");
  });
});

describe("bargaining", () => {
  it("tells the farmer when a buyer opens one", () => {
    const drafts = forBargain({
      before: undefined,
      after: thread({ messages: [message("buyer", "proposal")] }),
      negotiationId: "N-1",
    });

    expect(drafts).toHaveLength(1);
    expect(drafts.at(0)).toMatchObject({
      accountId: "F-1",
      audience: "farmer",
      kind: "bargainOpened",
      href: "/farm/bargains",
      subject: { counterparty: "Kongu Agri" },
    });
  });

  it("calls the second proposal a counter, not an opening", () => {
    const drafts = forBargain({
      before: thread({ messages: [message("buyer", "proposal")] }),
      after: thread({
        messages: [message("buyer", "proposal"), message("farmer", "proposal")],
      }),
      negotiationId: "N-1",
    });

    expect(drafts.at(0)).toMatchObject({
      accountId: "B-1",
      audience: "buyer",
      kind: "bargainCountered",
      href: "/bargains",
    });
  });

  it("never tells somebody about their own message", () => {
    const drafts = forBargain({
      before: thread({ messages: [message("buyer", "proposal")] }),
      after: thread({
        messages: [message("buyer", "proposal"), message("buyer", "note")],
      }),
      negotiationId: "N-1",
    });

    expect(drafts.map((d) => d.accountId)).toEqual(["F-1"]);
    expect(drafts.at(0)?.kind).toBe("bargainMessage");
  });

  it("tells both sides when it settles", () => {
    for (const [kind, expected] of [
      ["accept", "bargainAgreed"],
      ["withdraw", "bargainClosed"],
    ] as const) {
      const drafts = forBargain({
        before: thread({ messages: [message("buyer", "proposal")] }),
        after: thread({
          messages: [message("buyer", "proposal"), message("farmer", kind)],
          status: kind === "accept" ? "agreed" : "withdrawn",
        }),
        negotiationId: "N-1",
      });

      expect(drafts.map((d) => d.accountId).sort()).toEqual(["B-1", "F-1"]);
      expect(drafts.every((d) => d.kind === expected)).toBe(true);
      // Each side is told who the *other* one is.
      expect(drafts.find((d) => d.accountId === "F-1")?.subject.counterparty).toBe(
        "Kongu Agri",
      );
      expect(drafts.find((d) => d.accountId === "B-1")?.subject.counterparty).toBe(
        "R. Murugan",
      );
    }
  });

  it("sends an agreed farmer to their sales, not back to the bargain", () => {
    const drafts = forBargain({
      before: thread({ messages: [message("buyer", "proposal")] }),
      after: thread({
        messages: [message("buyer", "proposal"), message("farmer", "accept")],
      }),
      negotiationId: "N-1",
    });
    expect(drafts.find((d) => d.accountId === "F-1")?.href).toBe("/farm/sales");
  });

  it("says nothing when the document changed but no message was added", () => {
    // Status corrected by hand, a field backfilled — a write is not an event.
    const drafts = forBargain({
      before: thread({ messages: [message("buyer", "proposal")] }),
      after: thread({ messages: [message("buyer", "proposal")], updatedAt: "later" }),
      negotiationId: "N-1",
    });
    expect(drafts).toEqual([]);
  });

  it("says nothing about a deleted bargain", () => {
    expect(
      forBargain({ before: thread(), after: undefined, negotiationId: "N-1" }),
    ).toEqual([]);
  });

  it("tells both sides when transport is arranged", () => {
    const drafts = forBargain({
      before: thread({ status: "agreed" }),
      after: thread({
        status: "agreed",
        transport: { agencyName: "Kongu Transport", quantity: 150, unit: "kg" },
      }),
      negotiationId: "N-1",
    });

    expect(drafts.map((d) => d.accountId).sort()).toEqual(["B-1", "F-1"]);
    expect(drafts.every((d) => d.kind === "transportArranged")).toBe(true);
    // The agreed share, not the listed lot.
    expect(drafts.at(0)?.subject.quantity).toBe(150);
    expect(drafts.at(0)?.subject.agencyName).toBe("Kongu Transport");
  });

  it("does not repeat itself when an arranged dispatch is updated", () => {
    // An agency accepting changes the transport block; the vehicle was already
    // announced and saying so again is noise.
    const arranged = { agencyName: "Kongu Transport", quantity: 150, status: "requested" };
    const drafts = forBargain({
      before: thread({ transport: arranged }),
      after: thread({ transport: { ...arranged, status: "accepted" } }),
      negotiationId: "N-1",
    });
    expect(drafts).toEqual([]);
  });

  it("reports a settled bargain and its transport in one write", () => {
    // Both happening at once is unusual but legal, and neither should be lost.
    const drafts = forBargain({
      before: thread({ messages: [message("buyer", "proposal")] }),
      after: thread({
        messages: [message("buyer", "proposal"), message("farmer", "accept")],
        transport: { agencyName: "Kongu Transport", quantity: 600 },
      }),
      negotiationId: "N-1",
    });

    expect(drafts.filter((d) => d.kind === "transportArranged")).toHaveLength(2);
    expect(drafts.filter((d) => d.kind === "bargainAgreed")).toHaveLength(2);
  });
});

describe("orders", () => {
  const ORDER = {
    farmerId: "F-1",
    buyerName: "Kongu Agri",
    produceName: "Tomato",
    quantity: 400,
    unit: "kg",
  };

  it("tells the farmer and nobody else", () => {
    const drafts = forOrder({ order: ORDER, orderId: "O-1" });
    expect(drafts).toHaveLength(1);
    expect(drafts.at(0)).toMatchObject({
      accountId: "F-1",
      audience: "farmer",
      kind: "orderPlaced",
      href: "/farm/sales",
      subject: { quantity: 400, counterparty: "Kongu Agri" },
    });
  });

  it("says nothing for an order with no farmer on it", () => {
    expect(forOrder({ order: { ...ORDER, farmerId: "" }, orderId: "O-1" })).toEqual([]);
  });

  it("says nothing about seeded demo orders", () => {
    expect(forOrder({ order: { ...ORDER, seeded: true }, orderId: "O-1" })).toEqual([]);
  });
});
