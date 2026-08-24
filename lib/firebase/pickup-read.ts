import "server-only";

import {
  agencyDispatchable,
  offers,
  vehicleDispatchable,
  type Agency,
  type Vehicle,
} from "@/lib/domain/admin";
import { isPoint, type Point } from "@/lib/domain/distance";
import type { Place } from "@/lib/domain/location";
import type { Candidate, PickupRequest } from "@/lib/domain/pickup-request";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Assembling the vehicles a farmer can call, and reading the requests.
 *
 * A vehicle record carries a district but no coordinates, so "nearby" is worked
 * out from where its agency is based: the agency names a town, and a town is a
 * place with a pin on it. That is coarser than a live GPS feed and it is what
 * the platform actually knows — a vehicle whose town has never been pinned gets
 * no distance at all rather than a guessed one.
 *
 * Wiring a driver's position in later changes only `basedAt`; nothing above
 * this cares where the point came from.
 */

/** Where a town is, if anybody has pinned it. */
function pointOfTown(places: readonly Place[], town: string, district: string): Point | undefined {
  const named = places.find(
    (place) =>
      place.name.toLowerCase() === town.toLowerCase() &&
      place.districtId.endsWith(district.toLowerCase().replace(/\s+/g, "-")),
  );

  const fallback = named ?? places.find((p) => p.name.toLowerCase() === town.toLowerCase());
  if (!fallback) return undefined;

  const point = { lat: fallback.lat, lng: fallback.lng };
  return isPoint(point) ? point : undefined;
}

/**
 * Every vehicle that could be offered a job, with where it is based.
 *
 * `dispatchable` folds together the vehicle's own paperwork and its agency's
 * standing, because a farmer has no way to tell those apart and the answer to
 * both is the same: can this turn up legally today.
 */
export function candidates(input: {
  vehicles: readonly Vehicle[];
  agencies: readonly Agency[];
  places: readonly Place[];
  now: number;
}): Candidate[] {
  const { vehicles, agencies, places, now } = input;
  const byId = new Map(agencies.map((agency) => [agency.id, agency]));

  return vehicles.flatMap((vehicle): Candidate[] => {
    const agency = byId.get(vehicle.agencyId);
    if (!agency) return [];

    // An agency that does not do transport has no business being offered a
    // load, whatever is parked in its yard.
    if (!offers(agency, "transport")) return [];

    return [
      {
        id: vehicle.id,
        registration: vehicle.registration,
        type: vehicle.type,
        capacityKg: vehicle.capacityKg,
        refrigerated: vehicle.refrigerated,
        district: vehicle.district,
        // Where the agency will actually travel, which is what decides whether
        // this vehicle may take a job — not where it happens to be parked.
        serves: agency.districts,
        agencyId: agency.id,
        agencyName: agency.name,
        basedAt: pointOfTown(places, agency.town, agency.district),
        dispatchable:
          vehicleDispatchable(vehicle, now) && agencyDispatchable(agency, now),
      },
    ];
  });
}

/* -------------------------------------------------------------------------
   Requests
   ------------------------------------------------------------------------- */

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

export function shapePickup(id: string, data: Record<string, unknown>): PickupRequest {
  const accepted = data.acceptedBy as Record<string, unknown> | null | undefined;

  return {
    id,
    negotiationId: String(data.negotiationId ?? ""),
    farmerId: String(data.farmerId ?? ""),
    farmerName: String(data.farmerName ?? ""),
    produceName: String(data.produceName ?? ""),
    quantity: Number(data.quantity ?? 0),
    unit: String(data.unit ?? "kg"),
    pickupDistrict: String(data.pickupDistrict ?? ""),
    pickupVillage: data.pickupVillage ? String(data.pickupVillage) : undefined,
    pickupPoint:
      typeof data.lat === "number" && typeof data.lng === "number"
        ? { lat: data.lat, lng: data.lng }
        : undefined,
    wantedType: data.wantedType ? (data.wantedType as PickupRequest["wantedType"]) : undefined,
    needsRefrigeration: data.needsRefrigeration === true,
    status: (data.status ?? "searching") as PickupRequest["status"],
    requestedAt: toDate(data.requestedAt),
    expiresAt: toDate(data.expiresAt),
    acceptedBy: accepted
      ? {
          vehicleId: String(accepted.vehicleId ?? ""),
          registration: String(accepted.registration ?? ""),
          vehicleType: accepted.vehicleType as PickupRequest["wantedType"] extends undefined
            ? never
            : NonNullable<PickupRequest["wantedType"]>,
          agencyId: String(accepted.agencyId ?? ""),
          agencyName: String(accepted.agencyName ?? ""),
          driverName: accepted.driverName ? String(accepted.driverName) : undefined,
          acceptedAt: toDate(accepted.acceptedAt),
        }
      : undefined,
  };
}

/** Every request on one farmer's bargains, keyed by negotiation. */
export async function readPickups(farmerId: string): Promise<Record<string, PickupRequest>> {
  if (!farmerId || !hasAdminCredentials()) return {};

  try {
    const snapshot = await adminDb()
      .collection("pickups")
      .where("farmerId", "==", farmerId)
      .get();

    const out: Record<string, PickupRequest> = {};
    for (const doc of snapshot.docs) {
      const request = shapePickup(doc.id, doc.data());
      out[request.negotiationId] = request;
    }
    return out;
  } catch (error) {
    console.error("pickups unreadable", error);
    return {};
  }
}

/**
 * What is on offer to an agency right now.
 *
 * Every live broadcast, not only the ones aimed at this agency — the whole
 * point is that any suitable vehicle may take one. Suitability is applied on
 * the screen against the agency's own fleet, so a driver sees the jobs their
 * lorry could actually do.
 */
export async function readOpenPickups(): Promise<PickupRequest[]> {
  if (!hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb()
      .collection("pickups")
      .where("status", "==", "searching")
      .get();

    return snapshot.docs
      .map((doc) => shapePickup(doc.id, doc.data()))
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  } catch (error) {
    console.error("open pickups unreadable", error);
    return [];
  }
}

/**
 * Every run one agency has taken, newest first.
 *
 * Filtered in code rather than queried on `acceptedBy.agencyId`. A nested
 * field needs its own composite index to sort on, and this collection holds
 * one document per settled bargain rather than one per message — the scan is
 * cheaper than the index is to maintain, and it stays cheaper until the
 * platform is an order of magnitude larger than it is.
 *
 * Never throws. An agency's own history failing to load is not a reason to
 * fail the page it sits on.
 */
export async function readAgencyPickups(agencyId: string): Promise<PickupRequest[]> {
  if (!agencyId || !hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb().collection("pickups").get();

    return snapshot.docs
      .map((doc) => shapePickup(doc.id, doc.data()))
      .filter((pickup) => pickup.acceptedBy?.agencyId === agencyId)
      .sort(
        (a, b) =>
          (b.acceptedBy?.acceptedAt ?? b.requestedAt).getTime() -
          (a.acceptedBy?.acceptedAt ?? a.requestedAt).getTime(),
      );
  } catch (error) {
    console.error("agency pickups unreadable", { agencyId, error });
    return [];
  }
}
