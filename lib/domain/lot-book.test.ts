import { describe, expect, it } from "vitest";

import type { GradeQuantity } from "./listing-draft";
import { acrossLots, lotBook, lotBooks } from "./lot-book";
import type { GradeBand } from "./models";
import type { Negotiation, NegotiationMessage } from "./negotiation";

const T0 = new Date("2026-08-16T06:00:00Z");

const POSTED: GradeQuantity[] = [
  { grade: "a", quantity: 400 },
  { grade: "b", quantity: 200 },
];

let seq = 0;

/** An open bargain whose buyer has `bands` on the table. */
function bidding(
  buyerId: string,
  bands: GradeBand[] | null,
  over: Partial<Negotiation> = {},
): Negotiation {
  seq += 1;
  const messages: NegotiationMessage[] = bands
    ? [{ id: `M${seq}`, author: "buyer", kind: "proposal", bands, sentAt: T0 }]
    : [{ id: `M${seq}`, author: "buyer", kind: "note", text: "Interested", sentAt: T0 }];

  return {
    id: `N-${seq}`,
    listingId: "L-1",
    produceName: "Tomato",
    farmerId: "F-1",
    buyerId,
    farmerName: "Farmer",
    buyerName: buyerId,
    quantity: 600,
    unit: "kg",
    status: "open",
    messages,
    openedAt: T0,
    ...over,
  };
}

/** A settled bargain that took `bands` off the lot. */
function sold(buyerId: string, bands: GradeBand[]): Negotiation {
  return bidding(buyerId, bands, { status: "agreed", agreedBands: bands, agreedAt: T0 });
}

describe("an untouched lot", () => {
  it("is all remaining and nothing else", () => {
    const book = lotBook({ posted: POSTED, threads: [] });
    expect(book).toMatchObject({
      posted: 600,
      sold: 0,
      remaining: 600,
      yours: 0,
      others: 0,
      bidders: 0,
      oversubscribed: false,
      soldOut: false,
    });
  });
});

describe("what has sold", () => {
  it("comes off the remainder", () => {
    const book = lotBook({
      posted: POSTED,
      threads: [sold("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 150 }])],
    });
    expect(book.sold).toBe(150);
    expect(book.remaining).toBe(450);
    expect(book.soldOut).toBe(false);
  });

  it("counts a band with no quantity as the whole of that grade", () => {
    // Every band written before lots could be split.
    const book = lotBook({
      posted: POSTED,
      threads: [sold("B-1", [{ grade: "a", ratePerUnit: 2200 }])],
    });
    expect(book.sold).toBe(400);
    expect(book.remaining).toBe(200);
  });

  it("reports sold out when nothing is left", () => {
    const book = lotBook({
      posted: POSTED,
      threads: [
        sold("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 400 }]),
        sold("B-2", [{ grade: "b", ratePerUnit: 1800, quantity: 200 }]),
      ],
    });
    expect(book.remaining).toBe(0);
    expect(book.soldOut).toBe(true);
  });

  it("never reports a negative remainder", () => {
    // An over-sold lot is a data problem; it is not a licence to tell a farmer
    // they owe produce.
    const book = lotBook({
      posted: POSTED,
      threads: [sold("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 900 }])],
    });
    expect(book.remaining).toBe(200);
  });
});

describe("what is being bargained over", () => {
  it("adds up live bids across buyers", () => {
    const book = lotBook({
      posted: POSTED,
      threads: [
        bidding("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 100 }]),
        bidding("B-2", [{ grade: "a", ratePerUnit: 2300, quantity: 250 }]),
      ],
    });
    expect(book.others).toBe(350);
    expect(book.bidders).toBe(2);
  });

  it("overlaps, so demand can exceed what is left", () => {
    // The whole reason this is not one stacked bar. Bidding reserves nothing,
    // so three buyers can each be bidding for the same produce.
    const book = lotBook({
      posted: POSTED,
      threads: [
        bidding("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 400 }]),
        bidding("B-2", [{ grade: "a", ratePerUnit: 2300, quantity: 400 }]),
        bidding("B-3", [{ grade: "a", ratePerUnit: 2400, quantity: 400 }]),
      ],
    });
    expect(book.remaining).toBe(600);
    expect(book.others).toBe(1200);
    expect(book.oversubscribed).toBe(true);
  });

  it("counts only the latest offer in a thread that has run several rounds", () => {
    // Counting the opening bid too would report demand nobody is offering.
    const thread = bidding("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 100 }]);
    const later: Negotiation = {
      ...thread,
      messages: [
        ...thread.messages,
        {
          id: "M-later",
          author: "buyer",
          kind: "proposal",
          bands: [{ grade: "a", ratePerUnit: 2300, quantity: 250 }],
          sentAt: T0,
        },
      ],
    };
    expect(lotBook({ posted: POSTED, threads: [later] }).others).toBe(250);
  });

  it("ignores a thread where the buyer has only talked", () => {
    // Interest is not a bid.
    const book = lotBook({ posted: POSTED, threads: [bidding("B-1", null)] });
    expect(book.others).toBe(0);
    expect(book.bidders).toBe(0);
  });

  it("ignores settled threads — they are sold, not pending", () => {
    const book = lotBook({
      posted: POSTED,
      threads: [
        sold("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 150 }]),
        bidding("B-2", null, { status: "withdrawn" }),
      ],
    });
    expect(book.others).toBe(0);
    expect(book.sold).toBe(150);
  });

  it("counts one buyer bidding on two grades as one bidder", () => {
    const book = lotBook({
      posted: POSTED,
      threads: [
        bidding("B-1", [
          { grade: "a", ratePerUnit: 2200, quantity: 100 },
          { grade: "b", ratePerUnit: 1800, quantity: 50 },
        ]),
      ],
    });
    expect(book.bidders).toBe(1);
    expect(book.others).toBe(150);
  });

  it("is not oversubscribed when there is nothing left to be over", () => {
    const book = lotBook({
      posted: POSTED,
      threads: [
        sold("B-1", [
          { grade: "a", ratePerUnit: 2200, quantity: 400 },
          { grade: "b", ratePerUnit: 1800, quantity: 200 },
        ]),
      ],
    });
    expect(book.oversubscribed).toBe(false);
    expect(book.soldOut).toBe(true);
  });
});

describe("whose bid is whose", () => {
  const threads = [
    bidding("B-me", [{ grade: "a", ratePerUnit: 2200, quantity: 100 }]),
    bidding("B-rival", [{ grade: "a", ratePerUnit: 2300, quantity: 250 }]),
  ];

  it("splits the demand for the buyer looking at it", () => {
    const book = lotBook({ posted: POSTED, threads, viewerBuyerId: "B-me" });
    expect(book.yours).toBe(100);
    expect(book.others).toBe(250);
  });

  it("puts everything under others for the farmer, who has no bid", () => {
    const book = lotBook({ posted: POSTED, threads });
    expect(book.yours).toBe(0);
    expect(book.others).toBe(350);
  });
});

describe("per grade", () => {
  it("keeps the grades apart", () => {
    const book = lotBook({
      posted: POSTED,
      threads: [
        sold("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 100 }]),
        bidding("B-2", [{ grade: "b", ratePerUnit: 1800, quantity: 200 }]),
      ],
    });

    expect(book.lines).toEqual([
      { grade: "a", posted: 400, sold: 100, remaining: 300, yours: 0, others: 0, bidders: 0 },
      { grade: "b", posted: 200, sold: 0, remaining: 200, yours: 0, others: 200, bidders: 1 },
    ]);
  });

  it("leaves out a grade nobody listed or wants", () => {
    const book = lotBook({ posted: POSTED, threads: [] });
    expect(book.lines.map((l) => l.grade)).toEqual(["a", "b"]);
  });
});

describe("across several lots", () => {
  const listings = [
    { id: "L-1", grades: POSTED },
    { id: "L-2", grades: [{ grade: "a" as const, quantity: 1000 }] },
  ];

  const threads = [
    sold("B-1", [{ grade: "a", ratePerUnit: 2200, quantity: 100 }]),
    bidding("B-2", [{ grade: "a", ratePerUnit: 2300, quantity: 250 }]),
    { ...bidding("B-3", [{ grade: "a", ratePerUnit: 2400, quantity: 900 }]), listingId: "L-2" },
  ];

  it("books each lot against its own bargains", () => {
    const books = lotBooks({ listings, threads });
    expect(books["L-1"].sold).toBe(100);
    expect(books["L-1"].others).toBe(250);
    expect(books["L-2"].sold).toBe(0);
    expect(books["L-2"].others).toBe(900);
  });

  it("totals them for the line at the top of a console", () => {
    expect(acrossLots(lotBooks({ listings, threads }))).toEqual({
      posted: 1600,
      sold: 100,
      remaining: 1500,
      underBargain: 1150,
      lotsBargaining: 2,
      lotsSoldOut: 0,
    });
  });

  it("gives an empty book to a lot nobody has bargained on", () => {
    const books = lotBooks({ listings: [{ id: "L-9", grades: POSTED }], threads });
    expect(books["L-9"]).toMatchObject({ sold: 0, others: 0, remaining: 600 });
  });
});
