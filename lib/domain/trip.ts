import { haversineKm, type Point } from "./distance";

/**
 * A load on the road, and what the control room sees.
 *
 * A trip is created when a farmer accepts a quote, and from then on it is the
 * single thing the farmer, the buyer and operations are all looking at. That is
 * the point of it: today those three ask each other on the telephone where the
 * lorry is, and each gets a different answer.
 *
 * The stages are deliberately few and deliberately physical. Every one of them
 * is something a driver can confirm from the cab without interpreting anything:
 * they have set off, they are at the farm, it is loaded, they have arrived.
 * Anything finer would be a status nobody updates honestly.
 */

export const TRIP_STAGES = [
  /** Accepted, nobody has moved yet. */
  "booked",
  /** Driver is on the way to the farm. */
  "heading",
  /** At the farm gate. Grading and weighing happen here. */
  "atFarm",
  /** Loaded and away. */
  "loaded",
  /** At the buyer. */
  "delivered",
  /** Called off after booking. */
  "cancelled",
] as const;

export type TripStage = (typeof TRIP_STAGES)[number];

export const STAGE_LABELS: Record<TripStage, string> = {
  booked: "Booked",
  heading: "On the way to the farm",
  atFarm: "At the farm",
  loaded: "Loaded, on the road",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Stages a trip passes through, in order. Cancelled is not on the path. */
export const STAGE_ORDER: readonly TripStage[] = [
  "booked",
  "heading",
  "atFarm",
  "loaded",
  "delivered",
];

export interface TripPing {
  readonly at: Point;
  readonly recordedAt: Date;
  /** Metres per second, where the phone reported it. */
  readonly speed?: number;
}

export interface Trip {
  readonly id: string;
  readonly pickupId: string;
  readonly negotiationId: string;

  /** Everybody who may watch it. */
  readonly farmerId: string;
  readonly farmerName: string;
  readonly buyerId: string;
  readonly buyerName: string;
  readonly agencyId: string;
  readonly agencyName: string;

  readonly vehicleId: string;
  readonly registration: string;
  readonly driverName?: string;
  readonly driverMobile?: string;

  readonly produceName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly feePaise: number;

  readonly pickupVillage?: string;
  readonly pickupDistrict: string;
  readonly pickupPoint?: Point;
  readonly dropTown?: string;
  readonly dropPoint?: Point;

  readonly stage: TripStage;
  readonly bookedAt: Date;
  /** When each stage was reached. Only what has happened is present. */
  readonly stageAt: Partial<Record<TripStage, Date>>;

  /** Where it was last seen. Absent until the driver starts sending. */
  readonly lastPing?: TripPing;
}

export function isMoving(trip: Trip): boolean {
  return trip.stage === "heading" || trip.stage === "loaded";
}

export function isDone(trip: Trip): boolean {
  return trip.stage === "delivered" || trip.stage === "cancelled";
}

/* -------------------------------------------------------------------------
   Moving through the stages
   ------------------------------------------------------------------------- */

export type StageRefusal = "finished" | "backwards" | "notAStage";

/**
 * May the driver mark this stage?
 *
 * Forwards only. A trip that can go back to "on the way" after being delivered
 * is a trip whose history nobody can read, and the control room's whole value
 * is that everybody is looking at the same account of what happened.
 *
 * Skipping ahead is allowed. A driver who forgets to tap "at the farm" and taps
 * "loaded" from the farm gate has told the truth; refusing that would train
 * people to tap things that are not true in order to reach the one that is.
 */
export function canAdvance(
  trip: Trip,
  stage: TripStage,
): { ok: true } | { ok: false; code: StageRefusal; message: string } {
  if (!TRIP_STAGES.includes(stage)) {
    return { ok: false, code: "notAStage", message: "Unknown stage." };
  }

  if (isDone(trip)) {
    return {
      ok: false,
      code: "finished",
      message:
        trip.stage === "delivered"
          ? "This trip is already delivered."
          : "This trip was cancelled.",
    };
  }

  if (stage === "cancelled") return { ok: true };

  const from = STAGE_ORDER.indexOf(trip.stage);
  const to = STAGE_ORDER.indexOf(stage);

  if (to <= from) {
    return {
      ok: false,
      code: "backwards",
      message: `This trip is already at "${STAGE_LABELS[trip.stage]}".`,
    };
  }

  return { ok: true };
}

export function advance(trip: Trip, stage: TripStage, now: Date): Trip {
  return {
    ...trip,
    stage,
    stageAt: { ...trip.stageAt, [stage]: now },
  };
}

/* -------------------------------------------------------------------------
   Where it is
   ------------------------------------------------------------------------- */

/**
 * How far along, as a fraction, for a progress line.
 *
 * From the pickup to the drop, by how much of the straight-line distance is
 * behind the vehicle. Returns null when either end or the vehicle is unlocated
 * — a bar that reads zero because nobody has a position is indistinguishable
 * from one that reads zero because the lorry has not moved.
 */
export function progress(trip: Trip): number | null {
  const from = trip.pickupPoint;
  const to = trip.dropPoint;
  const at = trip.lastPing?.at;

  if (!from || !to || !at) return null;

  const total = haversineKm(from, to);
  if (total <= 0) return null;

  const remaining = haversineKm(at, to);
  const done = 1 - remaining / total;

  // Clamped: a vehicle that has overshot or wandered is at an end, not at a
  // negative fraction.
  return Math.max(0, Math.min(1, done));
}

/**
 * How stale the position is, in minutes.
 *
 * The control room's most important number after the stage. A dot that has not
 * moved for forty minutes is either a stopped lorry or a phone that has locked,
 * and the screen must not present the last known point as though it were
 * current.
 */
export function pingAgeMinutes(trip: Trip, now: number): number | null {
  if (!trip.lastPing) return null;
  return Math.max(0, Math.round((now - trip.lastPing.recordedAt.getTime()) / 60_000));
}

/** Past this, a position is history rather than a location. */
export const STALE_AFTER_MINUTES = 10;

export function isStale(trip: Trip, now: number): boolean {
  const age = pingAgeMinutes(trip, now);
  return age === null || age > STALE_AFTER_MINUTES;
}

/**
 * Is this ping worth recording?
 *
 * Drivers' phones report constantly and most of it says nothing new. Dropping
 * pings that have barely moved keeps the trail readable and the write volume
 * survivable — a vehicle parked at a farm gate for an hour should leave one
 * point, not seven hundred.
 */
export function worthRecording(
  previous: TripPing | undefined,
  next: TripPing,
  minMetres = 50,
): boolean {
  if (!previous) return true;

  // Time alone is enough eventually: a stationary lorry still needs to prove
  // it is being tracked, or the control room cannot tell it from a dead phone.
  const gapMs = next.recordedAt.getTime() - previous.recordedAt.getTime();
  if (gapMs >= 2 * 60_000) return true;
  if (gapMs <= 0) return false;

  return haversineKm(previous.at, next.at) * 1000 >= minMetres;
}
