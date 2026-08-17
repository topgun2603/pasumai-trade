import type { VehicleType } from "./admin";
import { isPoint, roadKm, type Point } from "./distance";

/**
 * Calling a vehicle, the way anybody actually calls one.
 *
 * The old flow made the farmer pick a transport *agency* from a list and wait
 * for it to answer. That is how a freight desk works, not how a person gets a
 * lorry: a farmer with produce cut and lying in the sun does not want to choose
 * a company, they want the nearest vehicle that can carry it, and they want to
 * know within a minute whether one is coming.
 *
 * So a request is **broadcast** and the first suitable owner to accept it wins.
 * That has three consequences the code has to take seriously:
 *
 *  - **The accept is a race.** Two drivers can tap at the same moment and only
 *    one can win. `claim` is written to be applied inside a transaction, and it
 *    refuses anything that is not still searching — the losing driver is told
 *    somebody else took it, not left believing they have a job.
 *
 *  - **A request has to expire.** A broadcast nobody answers must stop being
 *    live, or a farmer waits all afternoon on a notification that is never
 *    coming and the produce sits there.
 *
 *  - **Suitability is the platform's job, not the driver's.** A vehicle too
 *    small for the load, or without refrigeration for produce that needs it,
 *    should never be offered the request — the farmer cannot check a capacity
 *    from a village and should not have to.
 */

export type PickupStatus =
  /** Broadcast, nobody has taken it. */
  | "searching"
  /** A vehicle owner claimed it. Terminal, and a lorry is coming. */
  | "accepted"
  /** The farmer called it off before anybody took it. */
  | "cancelled"
  /** Nobody answered in time. */
  | "expired";

export const PICKUP_LABELS: Record<PickupStatus, string> = {
  searching: "Looking for a vehicle",
  accepted: "Vehicle confirmed",
  cancelled: "Cancelled",
  expired: "Nobody answered",
};

/** Who took the job. Denormalised so a row renders without three more reads. */
export interface Acceptance {
  readonly vehicleId: string;
  readonly registration: string;
  readonly vehicleType: VehicleType;
  readonly agencyId: string;
  readonly agencyName: string;
  readonly driverName?: string;
  readonly acceptedAt: Date;
}

export interface PickupRequest {
  readonly id: string;
  /** The settled bargain this collects. One request per bargain. */
  readonly negotiationId: string;
  readonly farmerId: string;
  readonly farmerName: string;
  readonly produceName: string;
  /** What is actually being collected — the agreed share, not the listed lot. */
  readonly quantity: number;
  readonly unit: string;
  readonly pickupDistrict: string;
  readonly pickupVillage?: string;
  /** Where from, when the village is on the map. Absent is normal, not an error. */
  readonly pickupPoint?: Point;
  /** What the farmer asked for. Absent means any vehicle that fits. */
  readonly wantedType?: VehicleType;
  /** Produce that must travel cold. Narrows the broadcast to reefers. */
  readonly needsRefrigeration: boolean;
  readonly status: PickupStatus;
  readonly requestedAt: Date;
  readonly expiresAt: Date;
  readonly acceptedBy?: Acceptance;
}

/**
 * How long a broadcast stays live.
 *
 * Long enough that a driver on the road has a fair chance of seeing it, short
 * enough that a farmer is not left waiting on nothing. Twenty minutes is the
 * compromise; it is a constant here rather than platform policy because it is
 * about human attention, not about a commercial term.
 */
export const PICKUP_WINDOW_MINUTES = 20;

export function isOpen(request: PickupRequest, now: number): boolean {
  return request.status === "searching" && now < request.expiresAt.getTime();
}

/** Live, but nobody has answered and the window has run out. */
export function hasLapsed(request: PickupRequest, now: number): boolean {
  return request.status === "searching" && now >= request.expiresAt.getTime();
}

/* -------------------------------------------------------------------------
   Which vehicles the request goes to
   ------------------------------------------------------------------------- */

/** The little a vehicle must expose to be considered. */
export interface Candidate {
  readonly id: string;
  readonly registration: string;
  readonly type: VehicleType;
  readonly capacityKg: number;
  readonly refrigerated: boolean;
  /** Where the vehicle is based. */
  readonly district: string;
  /**
   * Districts the agency will actually send it to.
   *
   * Separate from where it is based, and the one that decides whether a job is
   * takeable: an agency in Erode that covers Salem can fetch from either, and
   * one that covers neither has no business claiming the load however close the
   * yard happens to be.
   */
  readonly serves: readonly string[];
  readonly agencyId: string;
  readonly agencyName: string;
  /** Where it is based. Absent means the distance is unknown, not zero. */
  readonly basedAt?: Point;
  /** False for a vehicle whose paperwork has lapsed, or whose agency is suspended. */
  readonly dispatchable: boolean;
}

export interface NearbyVehicle extends Candidate {
  /** Estimated road kilometres, or null when either end has no coordinates. */
  readonly km: number | null;
}

export type UnsuitableReason =
  | "tooSmall"
  | "notRefrigerated"
  | "wrongType"
  | "unavailable"
  | "outsideCoverage";

/**
 * May this vehicle be offered this job?
 *
 * Checked on the platform's side, not the driver's. A farmer standing in a
 * village cannot verify that a tempo will take nine hundred kilos, and a driver
 * accepting a load they cannot carry wastes the one thing nobody can get back —
 * the hours the produce spends waiting.
 */
export function suitability(
  vehicle: Candidate,
  need: {
    quantityKg: number;
    needsRefrigeration: boolean;
    wantedType?: VehicleType;
    /** Where the produce is. Omitted only where the caller has already scoped it. */
    district?: string;
  },
): { ok: true } | { ok: false; reason: UnsuitableReason } {
  if (!vehicle.dispatchable) return { ok: false, reason: "unavailable" };

  // Checked here rather than only when the list is built, because the claim
  // goes through this too — otherwise "nearby" would be a filter on the screen
  // that a request to the endpoint simply walks past, and a lorry four hundred
  // kilometres away could take the job.
  if (need.district && !vehicle.serves.includes(need.district)) {
    return { ok: false, reason: "outsideCoverage" };
  }

  // Refrigeration first: it is the one that spoils a load rather than merely
  // inconveniencing it.
  if (need.needsRefrigeration && !vehicle.refrigerated) {
    return { ok: false, reason: "notRefrigerated" };
  }

  if (vehicle.capacityKg < need.quantityKg) return { ok: false, reason: "tooSmall" };

  if (need.wantedType && vehicle.type !== need.wantedType) {
    return { ok: false, reason: "wrongType" };
  }

  return { ok: true };
}

/**
 * The vehicles a farmer should see, nearest first.
 *
 * Vehicles with no known location sort last rather than being dropped: a lorry
 * in the right district whose base nobody has pinned is still a lorry, and
 * hiding it would make the platform look emptier than it is. What is not done
 * is inventing a distance for it — `km` is null and the screen says so.
 */
export function nearbyVehicles(
  vehicles: readonly Candidate[],
  from: Point | null,
  need: {
    quantityKg: number;
    needsRefrigeration: boolean;
    wantedType?: VehicleType;
    district: string;
    roadFactorPercent: number;
    /** Beyond this, a vehicle is not "nearby" whatever the map says. */
    radiusKm?: number;
  },
): NearbyVehicle[] {
  const rows: NearbyVehicle[] = [];

  for (const vehicle of vehicles) {
    if (!suitability(vehicle, { ...need, district: need.district }).ok) continue;

    const base = vehicle.basedAt;
    const km =
      from && base && isPoint(base) ? roadKm(from, base, need.roadFactorPercent) : null;

    // A radius only excludes vehicles we can actually measure. Dropping the
    // unlocated ones "to be safe" would quietly empty the list in exactly the
    // districts where nobody has pinned anything.
    if (km !== null && need.radiusKm !== undefined && km > need.radiusKm) continue;

    /*
      No second gate on where the vehicle is parked.

      An earlier version dropped unlocated vehicles based outside the district,
      which contradicted the rule right above it: `suitability` has already
      established that the agency covers this district and will travel here. The
      two disagreeing produced the worst possible result — a farmer told "no
      vehicles nearby" about a lorry that then accepted the job through the API.

      Distance is advisory and may be unknown; coverage is the permission, and
      it is decided in one place.
    */

    rows.push({ ...vehicle, km });
  }

  return rows.sort((a, b) => {
    if (a.km === null && b.km === null) return a.registration.localeCompare(b.registration);
    if (a.km === null) return 1;
    if (b.km === null) return -1;
    return a.km - b.km;
  });
}

/** How many of each type are about, for the farmer choosing what to ask for. */
export function byType(
  vehicles: readonly NearbyVehicle[],
): Array<{ type: VehicleType; count: number; nearestKm: number | null }> {
  const groups = new Map<VehicleType, NearbyVehicle[]>();
  for (const vehicle of vehicles) {
    const bucket = groups.get(vehicle.type);
    if (bucket) bucket.push(vehicle);
    else groups.set(vehicle.type, [vehicle]);
  }

  return [...groups.entries()]
    .map(([type, group]) => {
      const measured = group.map((v) => v.km).filter((km): km is number => km !== null);
      return {
        type,
        count: group.length,
        nearestKm: measured.length > 0 ? Math.min(...measured) : null,
      };
    })
    .sort((a, b) => {
      if (a.nearestKm === null && b.nearestKm === null) return b.count - a.count;
      if (a.nearestKm === null) return 1;
      if (b.nearestKm === null) return -1;
      return a.nearestKm - b.nearestKm;
    });
}

/* -------------------------------------------------------------------------
   Taking the job
   ------------------------------------------------------------------------- */

export type ClaimRefusal =
  | "alreadyTaken"
  | "notSearching"
  | "expired"
  | "unsuitable"
  | "ownRequest";

export interface ClaimResult {
  readonly ok: boolean;
  readonly code?: ClaimRefusal;
  readonly message?: string;
  readonly request?: PickupRequest;
}

/**
 * A vehicle owner takes the job.
 *
 * **Apply this inside a transaction.** Two drivers tapping Accept in the same
 * second is the ordinary case, not the edge case, and the whole promise of the
 * model — that accepting means the job is yours — rests on exactly one of them
 * winning. Read the request, call this, write only if it says ok.
 *
 * The refusal for the loser names what happened. "Somebody else got there
 * first" is disappointing; a spinner that silently does nothing is what makes a
 * driver stop using the app.
 */
export function claim(
  request: PickupRequest,
  vehicle: Candidate,
  now: number,
): ClaimResult {
  if (request.status === "accepted") {
    return {
      ok: false,
      code: "alreadyTaken",
      message: `${request.acceptedBy?.registration ?? "Another vehicle"} took this one first.`,
    };
  }

  if (request.status !== "searching") {
    return {
      ok: false,
      code: "notSearching",
      message:
        request.status === "cancelled"
          ? "The farmer called this off."
          : "This request is closed.",
    };
  }

  if (now >= request.expiresAt.getTime()) {
    return {
      ok: false,
      code: "expired",
      message: "This request has timed out. The farmer will send another.",
    };
  }

  const fits = suitability(vehicle, {
    quantityKg: request.quantity,
    needsRefrigeration: request.needsRefrigeration,
    wantedType: request.wantedType,
    district: request.pickupDistrict,
  });

  if (!fits.ok) {
    return {
      ok: false,
      code: "unsuitable",
      message:
        fits.reason === "tooSmall"
          ? `${request.quantity} ${request.unit} will not fit in ${vehicle.registration}.`
          : fits.reason === "notRefrigerated"
            ? "This load has to travel cold."
            : fits.reason === "wrongType"
              ? "The farmer asked for a different kind of vehicle."
              : fits.reason === "outsideCoverage"
                ? `Your agency does not cover ${request.pickupDistrict}.`
                : `${vehicle.registration} cannot take loads at the moment.`,
    };
  }

  return {
    ok: true,
    request: {
      ...request,
      status: "accepted",
      acceptedBy: {
        vehicleId: vehicle.id,
        registration: vehicle.registration,
        vehicleType: vehicle.type,
        agencyId: vehicle.agencyId,
        agencyName: vehicle.agencyName,
        acceptedAt: new Date(now),
      },
    },
  };
}

/** The farmer calling it off while it is still searching. */
export function cancel(request: PickupRequest): ClaimResult {
  if (request.status === "accepted") {
    return {
      ok: false,
      code: "alreadyTaken",
      message: `${request.acceptedBy?.registration ?? "A vehicle"} has already accepted. Phone them to stand it down.`,
    };
  }
  if (request.status !== "searching") {
    return { ok: false, code: "notSearching", message: "Nothing to cancel." };
  }
  return { ok: true, request: { ...request, status: "cancelled" } };
}

/** Closing a broadcast nobody answered. Not a refusal — nobody chose it. */
export function lapse(request: PickupRequest, now: number): PickupRequest {
  if (!hasLapsed(request, now)) return request;
  return { ...request, status: "expired" };
}
