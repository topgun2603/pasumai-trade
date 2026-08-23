import { describe, expect, it } from "vitest";

import type { Grade } from "./enums";
import type { GradeBand } from "./models";
import {
  applyMessage,
  canAccept,
  canPropose,
  expire,
  gap,
  isSettled,
  lastProposalBy,
  NegotiationError,
  partyFor,
  roundCount,
  standingProposal,
  valueAt,
  type DraftMessage,
  type Negotiation,
  type Party,
} from "./negotiation";

/**
 * These guards decide what a farmer is paid, so they are tested the way the
 * order transitions are: every refusal has a case, and the happy path is the
 * smallest part of the file.
 */

const T0 = new Date("2026-08-14T09:00:00+05:30");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

/** Rates in paise per kg: A, B, C. */
function bands(a: number, b: number, c: number): GradeBand[] {
  return [
    { grade: "a", ratePerUnit: a },
    { grade: "b", ratePerUnit: b },
    { grade: "c", ratePerUnit: c },
  ];
}

function fresh(): Negotiation {
  return {
    id: "N-1",
    listingId: "L-1",
    produceName: "Tomato",
    farmerId: "F-201",
    buyerId: "B-1001",
    farmerName: "R. Murugan",
    buyerName: "Kongu Agri Traders",
    quantity: 800,
    unit: "kg",
    status: "open",
    messages: [],
    openedAt: T0,
  };
}

let seq = 0;
function send(
  negotiation: Negotiation,
  author: Party,
  kind: DraftMessage["kind"],
  extra: Partial<DraftMessage> = {},
  remaining?: readonly { grade: Grade; quantity: number }[],
): Negotiation {
  seq += 1;
  return applyMessage(
    negotiation,
    { id: `M-${seq}`, author, kind, sentAt: at(seq), ...extra },
    remaining,
  );
}

/** The usual opening: farmer asks, buyer counters lower. */
function opened(): Negotiation {
  let n = fresh();
  n = send(n, "farmer", "proposal", { bands: bands(2500, 2000, 1400) });
  n = send(n, "buyer", "proposal", { bands: bands(2200, 1800, 1300) });
  return n;
}

describe("proposing", () => {
  it("accepts a complete, well-ordered set of rates", () => {
    expect(canPropose(fresh(), "farmer", bands(2500, 2000, 1400)).allowed).toBe(true);
  });

  it("accepts a proposal covering only some grades", () => {
    // Grades trade separately. A buyer who wants only the top grade bids on
    // grade A alone, and the rest of the lot is not part of that deal.
    expect(
      canPropose(fresh(), "buyer", [{ grade: "a", ratePerUnit: 2200 }]).allowed,
    ).toBe(true);
    expect(
      canPropose(fresh(), "buyer", [
        { grade: "a", ratePerUnit: 2200 },
        { grade: "c", ratePerUnit: 1300 },
      ]).allowed,
    ).toBe(true);
  });

  it("refuses a proposal that prices nothing at all", () => {
    const result = canPropose(fresh(), "buyer", []);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("incompletePricing");
      // Says the single-grade bid is allowed, because the person reading this
      // has just been refused and needs to know what *is* permitted.
      expect(result.refusal.message).toContain("single grade");
    }
  });

  it("checks ordering only across the grades actually priced", () => {
    // A and C priced, B skipped: C must still sit at or below A.
    expect(
      canPropose(fresh(), "buyer", [
        { grade: "a", ratePerUnit: 2200 },
        { grade: "c", ratePerUnit: 2400 },
      ]).allowed,
    ).toBe(false);
    expect(
      canPropose(fresh(), "buyer", [
        { grade: "a", ratePerUnit: 2200 },
        { grade: "c", ratePerUnit: 1300 },
      ]).allowed,
    ).toBe(true);
  });

  it("treats narrowing to fewer grades as a move, not a retreat", () => {
    // "Actually, just your grade A" is a legitimate counter.
    const result = canPropose(opened(), "buyer", [
      { grade: "a", ratePerUnit: 2200 },
    ]);
    expect(result.allowed).toBe(true);
  });

  it("refuses a zero or negative rate", () => {
    for (const rate of [0, -100]) {
      const result = canPropose(fresh(), "buyer", bands(2200, 1800, rate));
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.refusal.code).toBe("nonPositiveRate");
    }
  });

  it("refuses rates that price a worse grade above a better one", () => {
    // Two figures transposed. Catching it here saves an argument at the gate.
    const result = canPropose(fresh(), "buyer", bands(1800, 2200, 1300));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("gradeOrder");
  });

  it("allows equal rates across grades", () => {
    expect(canPropose(fresh(), "buyer", bands(2000, 2000, 2000)).allowed).toBe(true);
  });
});

describe("moving backwards", () => {
  it("stops a buyer lowering an offer they already made", () => {
    const result = canPropose(opened(), "buyer", bands(2100, 1800, 1300));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("movedBackwards");
      expect(result.refusal.message).toContain("₹22.00");
    }
  });

  it("stops a farmer raising an ask they already gave", () => {
    const result = canPropose(opened(), "farmer", bands(2600, 2000, 1400));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("movedBackwards");
  });

  it("lets a buyer improve and a farmer concede", () => {
    expect(canPropose(opened(), "buyer", bands(2350, 1900, 1350)).allowed).toBe(true);
    expect(canPropose(opened(), "farmer", bands(2400, 1950, 1350)).allowed).toBe(true);
  });

  it("judges each grade on its own", () => {
    // Better on A, worse on C. Still a retreat.
    const result = canPropose(opened(), "buyer", bands(2400, 1800, 1200));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("movedBackwards");
  });

  it("refuses a resend of identical rates", () => {
    const result = canPropose(opened(), "buyer", bands(2200, 1800, 1300));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("noChange");
  });

  it("only measures a party against their own history", () => {
    // The farmer opened at 2500; the buyer is at 2200. A farmer move to 2400 is
    // a concession, even though it is still above the buyer's number.
    expect(canPropose(opened(), "farmer", bands(2400, 1900, 1350)).allowed).toBe(true);
  });
});

describe("accepting", () => {
  it("refuses when nothing has been put forward", () => {
    const result = canAccept(fresh(), "buyer", at(5).getTime());
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("nothingToAccept");
  });

  it("refuses a party accepting their own price", () => {
    const result = canAccept(opened(), "buyer", at(5).getTime());
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("ownProposal");
  });

  it("lets the other side accept", () => {
    expect(canAccept(opened(), "farmer", at(5).getTime()).allowed).toBe(true);
  });

  it("refuses an expired proposal", () => {
    let n = fresh();
    n = send(n, "buyer", "proposal", {
      bands: bands(2200, 1800, 1300),
      validForMinutes: 30,
    });
    const proposal = standingProposal(n)!;
    const after = proposal.expiresAt!.getTime() + 1;

    const result = canAccept(n, "farmer", after);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("proposalExpired");
  });

  it("treats a proposal with no expiry as always live", () => {
    const distantFuture = T0.getTime() + 400 * 86_400_000;
    expect(canAccept(opened(), "farmer", distantFuture).allowed).toBe(true);
  });

  it("accepts the standing proposal, not the party's own earlier one", () => {
    // Farmer opened, buyer countered. The farmer accepting takes the buyer's
    // numbers — never their own opening ask.
    const settled = send(opened(), "farmer", "accept");
    expect(settled.agreedBands).toEqual(bands(2200, 1800, 1300));
  });
});

describe("settling", () => {
  it("records the agreed rates and closes the thread", () => {
    const settled = send(opened(), "farmer", "accept");
    expect(settled.status).toBe("agreed");
    expect(settled.agreedAt).toBeInstanceOf(Date);
    expect(isSettled(settled)).toBe(true);
  });

  it("snapshots the rates onto the accept message too", () => {
    const settled = send(opened(), "farmer", "accept");
    const last = settled.messages.at(-1)!;
    expect(last.kind).toBe("accept");
    expect(last.bands).toEqual(bands(2200, 1800, 1300));
  });

  it("refuses everything once agreed", () => {
    const settled = send(opened(), "farmer", "accept");

    expect(canPropose(settled, "buyer", bands(2300, 1900, 1350)).allowed).toBe(false);
    expect(canAccept(settled, "buyer", at(99).getTime()).allowed).toBe(false);
    expect(() => send(settled, "buyer", "note", { text: "one more thing" })).toThrow(
      NegotiationError,
    );
  });

  it("refuses everything once withdrawn", () => {
    const gone = send(opened(), "buyer", "withdraw", { text: "Sourced elsewhere" });
    expect(gone.status).toBe("withdrawn");
    expect(canAccept(gone, "farmer", at(99).getTime()).allowed).toBe(false);
    expect(() => send(gone, "buyer", "withdraw")).toThrow(NegotiationError);
  });

  it("expires a stale thread without calling it a withdrawal", () => {
    // A farmer told the buyer walked away, when in fact nobody replied, is a
    // farmer given the wrong reason to distrust the platform.
    const stale = expire(opened());
    expect(stale.status).toBe("expired");
    expect(stale.messages).toHaveLength(2);
  });

  it("leaves a settled thread alone when expiry sweeps it", () => {
    const settled = send(opened(), "farmer", "accept");
    expect(expire(settled)).toBe(settled);
  });

  it("throws on an illegal apply rather than returning a broken thread", () => {
    expect(() => send(opened(), "buyer", "accept")).toThrow(NegotiationError);
    try {
      send(opened(), "buyer", "accept");
    } catch (error) {
      expect((error as NegotiationError).code).toBe("ownProposal");
    }
  });
});

describe("partyFor", () => {
  /**
   * The single most dangerous decision in the module: it is what stops one
   * side accepting a price on the other's behalf. Every refusal has a case.
   */
  it("matches each side to their own account", () => {
    expect(partyFor(fresh(), "farmer", "F-201")).toBe("farmer");
    expect(partyFor(fresh(), "buyer", "B-1001")).toBe("buyer");
  });

  it("refuses a farmer who is not this farmer", () => {
    expect(partyFor(fresh(), "farmer", "F-999")).toBeNull();
  });

  it("refuses a buyer who is not this buyer", () => {
    expect(partyFor(fresh(), "buyer", "B-9999")).toBeNull();
  });

  it("refuses a farmer holding the buyer's id, and the reverse", () => {
    // The role and the id must agree. Either alone would let the wrong side
    // speak: a farmer presenting the buyer's account id, or a buyer presenting
    // the farmer's, are both exactly the attack this prevents.
    expect(partyFor(fresh(), "farmer", "B-1001")).toBeNull();
    expect(partyFor(fresh(), "buyer", "F-201")).toBeNull();
  });

  it("refuses operations", () => {
    // They may read a thread and must not speak in one. A price the platform
    // can quietly agree to is a price the record cannot vouch for.
    expect(partyFor(fresh(), "admin", "F-201")).toBeNull();
    expect(partyFor(fresh(), "admin", undefined)).toBeNull();
  });

  it("refuses an account with no id at all", () => {
    expect(partyFor(fresh(), "farmer", undefined)).toBeNull();
    expect(partyFor(fresh(), "farmer", "")).toBeNull();
  });
});

describe("reading the thread", () => {
  it("finds the standing proposal and each party's last", () => {
    const n = opened();
    expect(standingProposal(n)?.author).toBe("buyer");
    expect(lastProposalBy(n, "farmer")?.bands).toEqual(bands(2500, 2000, 1400));
    expect(lastProposalBy(n, "buyer")?.bands).toEqual(bands(2200, 1800, 1300));
  });

  it("ignores notes when looking for the standing proposal", () => {
    const n = send(opened(), "farmer", "note", { text: "Picked this morning" });
    expect(standingProposal(n)?.author).toBe("buyer");
  });

  it("measures the gap grade by grade", () => {
    expect(gap(opened())).toEqual({ a: 300, b: 200, c: 100 });
  });

  it("reports no gap before both sides have priced", () => {
    let n = fresh();
    n = send(n, "farmer", "proposal", { bands: bands(2500, 2000, 1400) });
    expect(gap(n)).toEqual({});
  });

  it("values the lot at the agreed rate for whatever grade it makes", () => {
    const settled = send(opened(), "farmer", "accept");
    // 800 kg at ₹18/kg for grade B.
    expect(valueAt(settled, settled.agreedBands!, "b").minorUnits).toBe(1_440_000);
  });

  it("counts only proposals as rounds", () => {
    const n = send(opened(), "farmer", "note", { text: "Ready to load" });
    expect(roundCount(n)).toBe(2);
  });
});

/**
 * Bidding for part of a lot.
 *
 * The guard has to hold against a stale client: a buyer's screen was drawn when
 * four hundred kilos were available and somebody else has taken three of them
 * since, so the check that matters is the one against `remaining` at the moment
 * the message lands.
 */
describe("partial quantities", () => {
  const remaining = [
    { grade: "a" as const, quantity: 400 },
    { grade: "b" as const, quantity: 200 },
  ];

  it("takes a bid for part of a grade", () => {
    const bid: GradeBand[] = [{ grade: "a", ratePerUnit: 2200, quantity: 150 }];
    expect(canPropose(fresh(), "buyer", bid, remaining).allowed).toBe(true);
  });

  it("refuses more of a grade than is left", () => {
    const bid: GradeBand[] = [{ grade: "a", ratePerUnit: 2200, quantity: 401 }];
    expect(canPropose(fresh(), "buyer", bid, remaining)).toMatchObject({
      allowed: false,
      refusal: { code: "exceedsAvailable" },
    });
  });

  it("refuses a grade with nothing available", () => {
    const bid: GradeBand[] = [{ grade: "c", ratePerUnit: 900, quantity: 10 }];
    const result = canPropose(fresh(), "buyer", bid, remaining);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.refusal.code).toBe("exceedsAvailable");
  });

  it("says how much is available without claiming why", () => {
    // `remaining` cannot distinguish "never offered" from "somebody just took
    // it", so the refusal states the limit and stops.
    // Under the lot's 800, so it is the per-grade limit of 200 that bites.
    const bid: GradeBand[] = [{ grade: "b", ratePerUnit: 1800, quantity: 500 }];
    const result = canPropose(fresh(), "buyer", bid, remaining);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.message).toContain("200");
      expect(result.refusal.message).not.toMatch(/sold|taken/i);
    }
  });

  it("refuses more than the lot even with no availability to check against", () => {
    // 800 kg listed. Without `remaining` there is no per-grade limit, but the
    // lot's own size still is one — this is the floor that holds when the
    // listing cannot be read.
    const bid: GradeBand[] = [{ grade: "a", ratePerUnit: 2200, quantity: 900 }];
    expect(canPropose(fresh(), "buyer", bid)).toMatchObject({
      allowed: false,
      refusal: { code: "exceedsAvailable" },
    });
  });

  it("refuses a fraction of a unit, and zero", () => {
    for (const quantity of [12.5, 0, -5]) {
      const bid: GradeBand[] = [{ grade: "a", ratePerUnit: 2200, quantity }];
      expect(canPropose(fresh(), "buyer", bid, remaining)).toMatchObject({
        allowed: false,
        refusal: { code: "badQuantity" },
      });
    }
  });

  it("treats wanting more at the same rate as a real counter-offer", () => {
    let n = fresh();
    n = send(n, "buyer", "proposal", {
      bands: [{ grade: "a", ratePerUnit: 2200, quantity: 100 }],
    });

    // Same money per kilo, twice the load. Refusing this as "no change" would
    // make a buyer raise their price to say they will take more.
    const more: GradeBand[] = [{ grade: "a", ratePerUnit: 2200, quantity: 200 }];
    expect(canPropose(n, "buyer", more, remaining).allowed).toBe(true);
  });

  it("still refuses a proposal that changes nothing at all", () => {
    let n = fresh();
    const bid: GradeBand[] = [{ grade: "a", ratePerUnit: 2200, quantity: 100 }];
    n = send(n, "buyer", "proposal", { bands: bid });

    expect(canPropose(n, "buyer", bid, remaining)).toMatchObject({
      allowed: false,
      refusal: { code: "noChange" },
    });
  });

  it("prices a partial bid at the quantity bid for, not the whole lot", () => {
    const bid: GradeBand[] = [{ grade: "a", ratePerUnit: 2200, quantity: 150 }];
    // 150 kg at ₹22, not 800 at ₹22.
    expect(valueAt(fresh(), bid, "a").minorUnits).toBe(330_000);
  });

  it("prices a band with no quantity as the whole lot, as it always did", () => {
    const bid: GradeBand[] = [{ grade: "a", ratePerUnit: 2200 }];
    expect(valueAt(fresh(), bid, "a").minorUnits).toBe(800 * 2200);
  });
});

describe("accepting after the lot has moved", () => {
  /*
    A bid is checked against what remains when it is made. Accepting was not,
    so a farmer with a bargain open could agree a price for produce another
    buyer had already taken — a binding commitment against stock that is gone.
    The check belongs at the accept, because that is the moment something
    becomes owed.
  */
  function offered() {
    let n = fresh();
    n = send(n, "buyer", "proposal", {
      bands: [{ grade: "a", ratePerUnit: 2200, quantity: 500 }],
    });
    return n;
  }

  it("refuses an accept when the whole lot has gone", () => {
    expect(() =>
      send(offered(), "farmer", "accept", {}, [{ grade: "a", quantity: 0 }]),
    ).toThrow(/sold since the offer was made/);
  });

  it("refuses an accept when only part of the grade is left", () => {
    // 500 kg was offered on; 200 kg remains. Half a deal is not the deal that
    // was agreed, so it is refused rather than silently reduced.
    expect(() =>
      send(offered(), "farmer", "accept", {}, [{ grade: "a", quantity: 200 }]),
    ).toThrow(/Only part of this is still available/);
  });

  it("allows the accept when the stock is still there", () => {
    const agreed = send(offered(), "farmer", "accept", {}, [
      { grade: "a", quantity: 500 },
    ]);
    expect(agreed.status).toBe("agreed");
  });

  it("does not refuse when the caller has nothing to compare against", () => {
    /*
      `applyMessage` is called from paths with no listing to hand. Refusing
      every accept for want of an argument would be worse than the bug it is
      guarding, so the check applies only when a remainder is supplied.
    */
    expect(send(offered(), "farmer", "accept").status).toBe("agreed");
  });
});
