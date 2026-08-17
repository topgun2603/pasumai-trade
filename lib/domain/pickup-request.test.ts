import { describe, expect, it } from "vitest";

import {
  byType,
  cancel,
  claim,
  hasLapsed,
  isOpen,
  lapse,
  nearbyVehicles,
  suitability,
  type Candidate,
  type PickupRequest,
} from "./pickup-request";

const T0 = new Date("2026-08-17T06:00:00Z");
const at = (minutes: number) => T0.getTime() + minutes * 60_000;

/** Sathyamangalam, roughly. */
const FARM = { lat: 11.5, lng: 77.24 };

function vehicle(over: Partial<Candidate> = {}): Candidate {
  return {
    id: "V-1",
    registration: "TN 20 BA 4471",
    type: "miniTruck",
    capacityKg: 1500,
    refrigerated: false,
    district: "Erode",
    serves: ["Erode", "Salem"],
    agencyId: "AG-1",
    agencyName: "Kongu Transport",
    basedAt: { lat: 11.52, lng: 77.26 },
    dispatchable: true,
    ...over,
  };
}

function request(over: Partial<PickupRequest> = {}): PickupRequest {
  return {
    id: "P-1",
    negotiationId: "N-1",
    farmerId: "F-1",
    farmerName: "R. Murugan",
    produceName: "Tomato",
    quantity: 400,
    unit: "kg",
    pickupDistrict: "Erode",
    needsRefrigeration: false,
    status: "searching",
    requestedAt: T0,
    expiresAt: new Date(at(20)),
    ...over,
  };
}

const NEED = {
  quantityKg: 400,
  needsRefrigeration: false,
  district: "Erode",
  roadFactorPercent: 130,
};

describe("suitability", () => {
  it("takes a vehicle big enough and in service", () => {
    expect(suitability(vehicle(), NEED)).toEqual({ ok: true });
  });

  it("refuses one too small for the load", () => {
    // The farmer cannot check a capacity from a village, and a driver arriving
    // unable to carry it costs the hours the produce spends waiting.
    expect(suitability(vehicle({ capacityKg: 200 }), NEED)).toMatchObject({
      ok: false,
      reason: "tooSmall",
    });
  });

  it("refuses a warm vehicle for a load that must travel cold", () => {
    expect(
      suitability(vehicle(), { ...NEED, needsRefrigeration: true }),
    ).toMatchObject({ ok: false, reason: "notRefrigerated" });
  });

  it("checks refrigeration before capacity", () => {
    // Both wrong; the one that spoils the load is the one worth naming.
    expect(
      suitability(vehicle({ capacityKg: 10 }), { ...NEED, needsRefrigeration: true }),
    ).toMatchObject({ reason: "notRefrigerated" });
  });

  it("respects a farmer asking for a particular kind", () => {
    expect(suitability(vehicle(), { ...NEED, wantedType: "reefer" })).toMatchObject({
      ok: false,
      reason: "wrongType",
    });
  });

  it("refuses one whose paperwork has lapsed", () => {
    expect(suitability(vehicle({ dispatchable: false }), NEED)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  it("refuses an agency that will not travel to the district", () => {
    // Being parked nearby is not the same as being willing to come. Without
    // this the "nearby" list is a filter on the screen that a request straight
    // to the endpoint walks past.
    expect(
      suitability(vehicle({ serves: ["Thanjavur"] }), { ...NEED, district: "Erode" }),
    ).toMatchObject({ ok: false, reason: "outsideCoverage" });
  });

  it("says nothing about coverage when the caller has already scoped it", () => {
    expect(suitability(vehicle({ serves: [] }), { quantityKg: 400, needsRefrigeration: false })).toEqual({
      ok: true,
    });
  });
});

describe("nearbyVehicles", () => {
  it("sorts nearest first", () => {
    const far = vehicle({ id: "V-far", registration: "FAR", basedAt: { lat: 12.5, lng: 78 } });
    const near = vehicle({ id: "V-near", registration: "NEAR" });

    const rows = nearbyVehicles([far, near], FARM, NEED);
    expect(rows.map((r) => r.id)).toEqual(["V-near", "V-far"]);
    expect(rows[0].km).toBeLessThan(rows[1].km!);
  });

  it("keeps a vehicle whose base nobody has pinned, and says the distance is unknown", () => {
    // Hiding it would make the platform look emptier than it is; inventing a
    // distance for it would be worse.
    const rows = nearbyVehicles([vehicle({ basedAt: undefined })], FARM, NEED);
    expect(rows).toHaveLength(1);
    expect(rows[0].km).toBeNull();
  });

  it("sorts unlocated vehicles last", () => {
    const rows = nearbyVehicles(
      [vehicle({ id: "V-unknown", basedAt: undefined }), vehicle({ id: "V-known" })],
      FARM,
      NEED,
    );
    expect(rows.map((r) => r.id)).toEqual(["V-known", "V-unknown"]);
  });

  it("offers a vehicle parked elsewhere whose agency covers the district", () => {
    // The farmer's list and the accept endpoint must agree. Excluding this one
    // told a farmer "no vehicles nearby" about a lorry that then took the job.
    const elsewhere = vehicle({ basedAt: undefined, district: "Salem" });
    expect(nearbyVehicles([elsewhere], FARM, NEED)).toHaveLength(1);
  });

  it("still excludes an agency that does not cover the district at all", () => {
    const away = vehicle({ basedAt: undefined, district: "Salem", serves: ["Thanjavur"] });
    expect(nearbyVehicles([away], FARM, NEED)).toEqual([]);
  });

  it("applies a radius only to vehicles it can measure", () => {
    const far = vehicle({ id: "V-far", basedAt: { lat: 13, lng: 78.5 } });
    const unlocated = vehicle({ id: "V-unlocated", basedAt: undefined });

    const rows = nearbyVehicles([far, unlocated], FARM, { ...NEED, radiusKm: 40 });
    // The far one is measurably outside; the unlocated one cannot be excluded
    // by a radius nobody can compute for it.
    expect(rows.map((r) => r.id)).toEqual(["V-unlocated"]);
  });

  it("leaves out anything unsuitable before it ever reaches the farmer", () => {
    const rows = nearbyVehicles(
      [vehicle({ id: "small", capacityKg: 50 }), vehicle({ id: "fine" })],
      FARM,
      NEED,
    );
    expect(rows.map((r) => r.id)).toEqual(["fine"]);
  });

  it("copes with a farm nobody has pinned", () => {
    const rows = nearbyVehicles([vehicle()], null, NEED);
    expect(rows).toHaveLength(1);
    expect(rows[0].km).toBeNull();
  });
});

describe("byType", () => {
  it("counts each kind and reports its nearest", () => {
    const rows = nearbyVehicles(
      [
        vehicle({ id: "a", type: "tempo", basedAt: { lat: 11.9, lng: 77.6 } }),
        vehicle({ id: "b", type: "miniTruck" }),
        vehicle({ id: "c", type: "miniTruck", basedAt: { lat: 11.7, lng: 77.4 } }),
      ],
      FARM,
      NEED,
    );

    const groups = byType(rows);
    expect(groups.map((g) => g.type)).toEqual(["miniTruck", "tempo"]);
    expect(groups[0].count).toBe(2);
    expect(groups[0].nearestKm).not.toBeNull();
  });

  it("reports an unknown nearest rather than zero", () => {
    const rows = nearbyVehicles([vehicle({ basedAt: undefined })], FARM, NEED);
    expect(byType(rows)[0].nearestKm).toBeNull();
  });
});

describe("claiming — the race", () => {
  it("lets the first suitable vehicle take it", () => {
    const result = claim(request(), vehicle(), at(1));
    expect(result.ok).toBe(true);
    expect(result.request?.status).toBe("accepted");
    expect(result.request?.acceptedBy).toMatchObject({
      registration: "TN 20 BA 4471",
      agencyName: "Kongu Transport",
    });
  });

  it("refuses the second, and says who won", () => {
    // The whole promise of the model is that accepting means the job is yours.
    // The loser is told what happened rather than left with a dead button.
    const taken = claim(request(), vehicle(), at(1)).request!;
    const second = claim(taken, vehicle({ id: "V-2", registration: "TN 33 AA 1" }), at(1));

    expect(second.ok).toBe(false);
    expect(second.code).toBe("alreadyTaken");
    expect(second.message).toContain("TN 20 BA 4471");
  });

  it("refuses after the window closes", () => {
    expect(claim(request(), vehicle(), at(21))).toMatchObject({
      ok: false,
      code: "expired",
    });
  });

  it("refuses a vehicle from an agency that does not cover the district", () => {
    const result = claim(request(), vehicle({ serves: ["Thanjavur"] }), at(1));
    expect(result).toMatchObject({ ok: false, code: "unsuitable" });
    expect(result.message).toContain("Erode");
  });

  it("refuses a vehicle that cannot do the job, with the reason", () => {
    const result = claim(request(), vehicle({ capacityKg: 100 }), at(1));
    expect(result).toMatchObject({ ok: false, code: "unsuitable" });
    expect(result.message).toContain("400 kg");
  });

  it("refuses one the farmer already called off", () => {
    expect(claim(request({ status: "cancelled" }), vehicle(), at(1))).toMatchObject({
      ok: false,
      code: "notSearching",
    });
  });

  it("does not mutate the request it was given", () => {
    const original = request();
    claim(original, vehicle(), at(1));
    expect(original.status).toBe("searching");
    expect(original.acceptedBy).toBeUndefined();
  });
});

describe("cancelling and lapsing", () => {
  it("lets the farmer call off a search nobody has taken", () => {
    expect(cancel(request()).request?.status).toBe("cancelled");
  });

  it("refuses to cancel once a vehicle has accepted", () => {
    // Somebody may already be on the road.
    const taken = claim(request(), vehicle(), at(1)).request!;
    const result = cancel(taken);
    expect(result).toMatchObject({ ok: false, code: "alreadyTaken" });
    expect(result.message).toContain("Phone them");
  });

  it("expires a broadcast nobody answered", () => {
    expect(hasLapsed(request(), at(21))).toBe(true);
    expect(lapse(request(), at(21)).status).toBe("expired");
  });

  it("leaves a live request alone", () => {
    expect(isOpen(request(), at(5))).toBe(true);
    expect(lapse(request(), at(5)).status).toBe("searching");
  });

  it("does not expire something already settled", () => {
    const taken = claim(request(), vehicle(), at(1)).request!;
    expect(lapse(taken, at(99)).status).toBe("accepted");
  });
});
