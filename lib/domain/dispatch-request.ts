import { agencyDispatchable, offers, type Agency } from "./admin";
import type { Negotiation } from "./negotiation";

/**
 * Handing a settled lot to a transport agency.
 *
 * The step nobody had. A bargain agreed a price and then stopped — the produce
 * was still in the field and the farmer's next move was a phone call the
 * platform knew nothing about. This is that call, made in the open, so the
 * buyer can see a vehicle is coming and the platform can settle a trip against
 * it afterwards.
 *
 * The farmer chooses, not the platform. A farmer knows which lorry turns up and
 * which one does not, and taking that decision away in the name of automatic
 * allocation would be the platform being confident about something it cannot
 * observe.
 */

export type DispatchStatus =
  /** Farmer asked; the agency has not answered. */
  | "requested"
  /** Agency took it. A vehicle is coming. */
  | "accepted"
  /** Agency cannot take it. The farmer picks another. */
  | "declined"
  /** Farmer changed their mind before it was accepted. */
  | "cancelled";

export const DISPATCH_LABELS: Record<DispatchStatus, string> = {
  requested: "Waiting on the agency",
  accepted: "Transport confirmed",
  declined: "Agency declined",
  cancelled: "Cancelled",
};

export interface DispatchRequest {
  readonly negotiationId: string;
  readonly agencyId: string;
  /** Denormalised so a row renders without a second read. */
  readonly agencyName: string;
  readonly status: DispatchStatus;
  readonly requestedAt: Date;
  readonly respondedAt?: Date;
  /** Where it is going from. */
  readonly pickupDistrict: string;
  /** Why an agency said no, for the farmer choosing the next one. */
  readonly reason?: string;
}

export class DispatchError extends Error {
  constructor(
    readonly code: DispatchRefusal,
    message: string,
  ) {
    super(message);
    this.name = "DispatchError";
  }
}

export type DispatchRefusal =
  | "notAgreed"
  | "alreadyArranged"
  | "agencyUnavailable"
  | "outsideCoverage";

/**
 * May this lot be handed to this agency, right now?
 *
 * Fails closed like the order guards, and in this order deliberately: the state
 * of the bargain first, because arranging transport for a price nobody agreed
 * is the mistake with a lorry at the end of it.
 */
export function canRequest(input: {
  negotiation: Negotiation;
  agency: Agency;
  existing?: DispatchRequest | null;
  pickupDistrict: string;
  now: number;
}): { ok: true } | { ok: false; code: DispatchRefusal; message: string } {
  const { negotiation, agency, existing, pickupDistrict, now } = input;

  if (negotiation.status !== "agreed") {
    return {
      ok: false,
      code: "notAgreed",
      message: "Settle the price first. Transport is arranged once a bargain is agreed.",
    };
  }

  // A declined or cancelled request is not in the way; anything else is.
  if (existing && (existing.status === "requested" || existing.status === "accepted")) {
    return {
      ok: false,
      code: "alreadyArranged",
      message:
        existing.status === "accepted"
          ? `${existing.agencyName} is already carrying this lot.`
          : `${existing.agencyName} has not answered yet. Cancel that first.`,
    };
  }

  if (!offers(agency, "transport")) {
    return {
      ok: false,
      code: "agencyUnavailable",
      message: `${agency.name} does not do transport.`,
    };
  }

  // Suspended, unverified, or carrying a lapsed document. The last one matters
  // most: a vehicle on the road without insurance makes the load uninsured and
  // the platform arranged the movement.
  if (!agencyDispatchable(agency, now)) {
    return {
      ok: false,
      code: "agencyUnavailable",
      message: `${agency.name} cannot take loads at the moment — their paperwork is not in order.`,
    };
  }

  if (!agency.districts.includes(pickupDistrict)) {
    return {
      ok: false,
      code: "outsideCoverage",
      message: `${agency.name} does not cover ${pickupDistrict}.`,
    };
  }

  return { ok: true };
}

export function requestDispatch(
  negotiation: Negotiation,
  agency: Agency,
  pickupDistrict: string,
  now: Date,
): DispatchRequest {
  return {
    negotiationId: negotiation.id,
    agencyId: agency.id,
    agencyName: agency.name,
    status: "requested",
    requestedAt: now,
    pickupDistrict,
  };
}

/**
 * Agencies a farmer in this district can actually pick from.
 *
 * Filtered rather than listed-and-greyed: a farmer scrolling a list of lorries
 * that cannot come is a farmer who thinks the platform has no transport. The
 * ones excluded are excluded for reasons they cannot act on.
 */
export function availableAgencies(
  agencies: readonly Agency[],
  district: string,
  now: number,
): Agency[] {
  return agencies
    .filter(
      (a) => offers(a, "transport") && agencyDispatchable(a, now) && a.districts.includes(district),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
