import { describe, expect, it } from "vitest";

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
): Negotiation {
  seq += 1;
  return applyMessage(negotiation, {
    id: `M-${seq}`,
    author,
    kind,
    sentAt: at(seq),
    ...extra,
  });
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
