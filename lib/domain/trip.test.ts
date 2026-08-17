import { describe, expect, it } from "vitest";

import {
  advance,
  canAdvance,
  isDone,
  isMoving,
  isStale,
  pingAgeMinutes,
  progress,
  worthRecording,
  type Trip,
  type TripStage,
} from "./trip";

const T0 = new Date("2026-08-17T06:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

/** Sathyamangalam to Erode, roughly 40 km apart. */
const FARM = { lat: 11.5, lng: 77.24 };
const DROP = { lat: 11.34, lng: 77.72 };

function trip(over: Partial<Trip> = {}): Trip {
  return {
    id: "T-1",
    pickupId: "P-1",
    negotiationId: "N-1",
    farmerId: "F-1",
    farmerName: "R. Murugan",
    buyerId: "B-1",
    buyerName: "Kongu Agri",
    agencyId: "AG-1",
    agencyName: "Kongu Transport",
    vehicleId: "V-1",
    registration: "TN 33 AZ 8890",
    produceName: "Tomato",
    quantity: 400,
    unit: "kg",
    feePaise: 250000,
    pickupDistrict: "Erode",
    pickupPoint: FARM,
    dropPoint: DROP,
    stage: "booked",
    bookedAt: T0,
    stageAt: { booked: T0 },
    ...over,
  };
}

describe("stages", () => {
  it("moves forwards", () => {
    expect(canAdvance(trip(), "heading").ok).toBe(true);
    expect(advance(trip(), "heading", at(5)).stage).toBe("heading");
  });

  it("records when each stage was reached", () => {
    const moved = advance(trip(), "heading", at(5));
    expect(moved.stageAt.booked).toEqual(T0);
    expect(moved.stageAt.heading).toEqual(at(5));
  });

  it("refuses to go backwards", () => {
    // The control room's value is that everybody reads the same account of what
    // happened; a trip that can un-deliver has no account.
    const loaded = trip({ stage: "loaded" });
    expect(canAdvance(loaded, "heading")).toMatchObject({ ok: false, code: "backwards" });
  });

  it("refuses to repeat the stage it is already at", () => {
    expect(canAdvance(trip({ stage: "atFarm" }), "atFarm")).toMatchObject({
      ok: false,
      code: "backwards",
    });
  });

  it("allows skipping ahead", () => {
    // A driver who forgets "at the farm" and taps "loaded" from the farm gate
    // has told the truth. Refusing it teaches people to tap untrue things.
    expect(canAdvance(trip(), "loaded").ok).toBe(true);
  });

  it("refuses anything once delivered or cancelled", () => {
    for (const stage of ["delivered", "cancelled"] as TripStage[]) {
      expect(canAdvance(trip({ stage }), "loaded")).toMatchObject({
        ok: false,
        code: "finished",
      });
    }
  });

  it("allows cancelling from anywhere still running", () => {
    expect(canAdvance(trip({ stage: "loaded" }), "cancelled").ok).toBe(true);
  });

  it("knows what is moving and what is finished", () => {
    expect(isMoving(trip({ stage: "heading" }))).toBe(true);
    expect(isMoving(trip({ stage: "loaded" }))).toBe(true);
    expect(isMoving(trip({ stage: "atFarm" }))).toBe(false);
    expect(isDone(trip({ stage: "delivered" }))).toBe(true);
  });
});

describe("progress", () => {
  it("is nothing when the vehicle has not reported", () => {
    // A bar at zero because nobody has a position looks exactly like a bar at
    // zero because the lorry has not moved.
    expect(progress(trip())).toBeNull();
  });

  it("is nothing when either end is unpinned", () => {
    const ping = { at: FARM, recordedAt: T0 };
    expect(progress(trip({ lastPing: ping, dropPoint: undefined }))).toBeNull();
    expect(progress(trip({ lastPing: ping, pickupPoint: undefined }))).toBeNull();
  });

  it("is near zero at the farm and near one at the drop", () => {
    expect(progress(trip({ lastPing: { at: FARM, recordedAt: T0 } }))).toBeCloseTo(0, 1);
    expect(progress(trip({ lastPing: { at: DROP, recordedAt: T0 } }))).toBeCloseTo(1, 1);
  });

  it("clamps a vehicle that has overshot", () => {
    const beyond = { lat: 11.2, lng: 78.4 };
    const value = progress(trip({ lastPing: { at: beyond, recordedAt: T0 } }));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});

describe("staleness", () => {
  it("reports how old the last position is", () => {
    const moving = trip({ lastPing: { at: FARM, recordedAt: T0 } });
    expect(pingAgeMinutes(moving, at(7).getTime())).toBe(7);
  });

  it("treats a trip that has never reported as stale", () => {
    // Not "at the farm" — unknown. The screen must not present nothing as a
    // location.
    expect(isStale(trip(), T0.getTime())).toBe(true);
    expect(pingAgeMinutes(trip(), T0.getTime())).toBeNull();
  });

  it("goes stale once the phone stops reporting", () => {
    const moving = trip({ lastPing: { at: FARM, recordedAt: T0 } });
    expect(isStale(moving, at(3).getTime())).toBe(false);
    expect(isStale(moving, at(40).getTime())).toBe(true);
  });
});

describe("worthRecording", () => {
  const first = { at: FARM, recordedAt: T0 };

  it("always records the first", () => {
    expect(worthRecording(undefined, first)).toBe(true);
  });

  it("drops a ping that has barely moved", () => {
    // A lorry parked at a farm gate for an hour should leave one point, not
    // seven hundred.
    const nudge = { at: { lat: 11.5001, lng: 77.2401 }, recordedAt: at(0.2) };
    expect(worthRecording(first, nudge)).toBe(false);
  });

  it("records a real movement", () => {
    const moved = { at: { lat: 11.52, lng: 77.3 }, recordedAt: at(1) };
    expect(worthRecording(first, moved)).toBe(true);
  });

  it("records a stationary vehicle eventually", () => {
    // A parked lorry still has to prove it is being tracked, or the control
    // room cannot tell it from a dead phone.
    const same = { at: FARM, recordedAt: at(3) };
    expect(worthRecording(first, same)).toBe(true);
  });

  it("ignores a ping older than the one it has", () => {
    const late = { at: { lat: 11.9, lng: 77.9 }, recordedAt: at(-5) };
    expect(worthRecording(first, late)).toBe(false);
  });
});
