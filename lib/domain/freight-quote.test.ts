import { describe, expect, it } from "vitest";

import {
  canAcceptQuote,
  canQuote,
  highlights,
  inChoosingOrder,
  type FreightQuote,
} from "./freight-quote";

const T0 = new Date("2026-08-17T06:00:00Z");
const at = (minutes: number) => T0.getTime() + minutes * 60_000;

function quote(over: Partial<FreightQuote> = {}): FreightQuote {
  return {
    id: "Q-1",
    pickupId: "P-1",
    agencyId: "AG-1",
    agencyName: "Kongu Transport",
    vehicleId: "V-1",
    registration: "TN 33 AZ 8890",
    vehicleType: "truck",
    capacityKg: 9000,
    refrigerated: false,
    feePaise: 250000,
    status: "offered",
    offeredAt: T0,
    ...over,
  };
}

const PICKUP = {
  status: "searching",
  expiresAt: new Date(at(20)),
  farmerId: "F-1",
};

describe("quoting", () => {
  const base = { pickup: PICKUP, existing: [], agencyId: "AG-1", now: at(1) };

  it("takes an ordinary fee", () => {
    expect(canQuote({ ...base, feePaise: 250000 })).toEqual({ ok: true });
  });

  it("refuses a second live quote from the same agency", () => {
    // Two prices from one company means the farmer has to work out which is
    // current. Withdraw and re-quote instead.
    expect(
      canQuote({ ...base, existing: [quote()], feePaise: 300000 }),
    ).toMatchObject({ ok: false, code: "alreadyQuoted" });
  });

  it("lets an agency re-quote after withdrawing", () => {
    expect(
      canQuote({ ...base, existing: [quote({ status: "withdrawn" })], feePaise: 300000 }),
    ).toEqual({ ok: true });
  });

  it("lets a different agency quote alongside", () => {
    expect(
      canQuote({ ...base, existing: [quote({ agencyId: "AG-2" })], feePaise: 300000 }),
    ).toEqual({ ok: true });
  });

  it("refuses a free trip", () => {
    // Not generosity: a mistake, or a way to win the job and argue at the gate.
    expect(canQuote({ ...base, feePaise: 0 })).toMatchObject({
      ok: false,
      code: "badFee",
    });
  });

  it("refuses a fee that looks like rupees typed where paise were meant", () => {
    // The error that turns ₹1,200 into ₹1,20,000 and is invisible until
    // somebody accepts it.
    const result = canQuote({ ...base, feePaise: 12_00_000_00 });
    expect(result.code).toBe("badFee");
    expect(result.message).toContain("rupees");
  });

  it("refuses a fraction of a paisa", () => {
    expect(canQuote({ ...base, feePaise: 2500.5 })).toMatchObject({ code: "badFee" });
  });

  it("refuses once the farmer has chosen", () => {
    expect(
      canQuote({ ...base, pickup: { ...PICKUP, status: "accepted" } }),
    ).toMatchObject({ ok: false, code: "notSearching" });
  });

  it("refuses after the window closes", () => {
    expect(canQuote({ ...base, feePaise: 250000, now: at(21) })).toMatchObject({
      ok: false,
      code: "expired",
    });
  });
});

describe("reading the quotes", () => {
  it("puts the cheapest first", () => {
    const rows = inChoosingOrder([
      quote({ id: "dear", feePaise: 400000 }),
      quote({ id: "cheap", feePaise: 200000 }),
    ]);
    expect(rows.map((q) => q.id)).toEqual(["cheap", "dear"]);
  });

  it("breaks a tie on who can get there soonest", () => {
    const rows = inChoosingOrder([
      quote({ id: "later", canArriveInMinutes: 90 }),
      quote({ id: "sooner", canArriveInMinutes: 30 }),
    ]);
    expect(rows.map((q) => q.id)).toEqual(["sooner", "later"]);
  });

  it("drops quotes nobody can take any more", () => {
    // A price no longer available is a price somebody misreads.
    const rows = inChoosingOrder([
      quote({ id: "gone", status: "withdrawn" }),
      quote({ id: "live" }),
    ]);
    expect(rows.map((q) => q.id)).toEqual(["live"]);
  });

  it("marks the cheapest and the soonest separately", () => {
    // Rarely the same quote, and which matters is the farmer's call.
    const marks = highlights([
      quote({ id: "cheap", feePaise: 200000, canArriveInMinutes: 120 }),
      quote({ id: "quick", feePaise: 400000, canArriveInMinutes: 20 }),
    ]);
    expect(marks.cheapestId).toBe("cheap");
    expect(marks.soonestId).toBe("quick");
  });

  it("marks nothing when there is only one quote", () => {
    expect(highlights([quote()])).toEqual({});
  });

  it("leaves the cheapest unmarked when two cost the same", () => {
    const marks = highlights([
      quote({ id: "a", feePaise: 200000 }),
      quote({ id: "b", feePaise: 200000 }),
    ]);
    expect(marks.cheapestId).toBeUndefined();
  });
});

describe("accepting a quote", () => {
  const base = { quote: quote(), pickup: PICKUP, farmerId: "F-1", now: at(5) };

  it("lets the farmer take one", () => {
    expect(canAcceptQuote(base)).toEqual({ ok: true });
  });

  it("refuses somebody else's request", () => {
    expect(canAcceptQuote({ ...base, farmerId: "F-9" })).toMatchObject({
      ok: false,
      code: "notYours",
    });
  });

  it("refuses a withdrawn quote, and says who withdrew it", () => {
    const result = canAcceptQuote({ ...base, quote: quote({ status: "withdrawn" }) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Kongu Transport");
  });

  it("refuses a second acceptance", () => {
    expect(
      canAcceptQuote({ ...base, pickup: { ...PICKUP, status: "accepted" } }),
    ).toMatchObject({ ok: false, code: "notSearching" });
  });

  it("still accepts just after the window closes", () => {
    // A quote the farmer is looking at should not vanish under their thumb.
    // Expiry stops new quotes, not this decision.
    expect(canAcceptQuote({ ...base, now: at(22) })).toEqual({ ok: true });
  });

  it("gives up eventually", () => {
    expect(canAcceptQuote({ ...base, now: at(40) })).toMatchObject({
      ok: false,
      code: "expired",
    });
  });
});
