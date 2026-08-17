import { requireCapability } from "@/lib/api/capability";
import type { VehicleType } from "@/lib/domain/admin";
import { agreedQuantity } from "@/lib/domain/dispatch-request";
import { partyFor } from "@/lib/domain/negotiation";
import { PICKUP_WINDOW_MINUTES } from "@/lib/domain/pickup-request";
import { adminDb } from "@/lib/firebase/admin";
import { readFarmer } from "@/lib/firebase/farmer-read";
import { shapeNegotiation } from "@/lib/firebase/negotiations-read";

/**
 * A farmer calls for a vehicle.
 *
 * Broadcast, not addressed: the request goes out and any suitable vehicle may
 * take it. The farmer may name a *type* — a tempo rather than a truck — but
 * never a company, because choosing a company is what made the old flow feel
 * like filing a docket instead of calling a lorry.
 *
 * One live request per bargain. Two broadcasts for one load means two vehicles
 * turning up for produce that fills one, and the second driver has wasted a
 * morning on the platform's arithmetic.
 */

const TYPES: VehicleType[] = ["miniTruck", "tempo", "truck", "reefer"];

export async function POST(request: Request) {
  // Gated on `bargain`, like arranging transport always was: calling the lorry
  // is part of concluding the sale, not a thing of its own.
  const gate = await requireCapability("bargain", "farmer");
  if (!gate.ok) return gate.response;

  let body: { negotiationId?: unknown; vehicleType?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const negotiationId =
    typeof body.negotiationId === "string" ? body.negotiationId : "";
  if (!negotiationId) {
    return Response.json({ error: "Which bargain?" }, { status: 422 });
  }

  const wantedType =
    typeof body.vehicleType === "string" && TYPES.includes(body.vehicleType as VehicleType)
      ? (body.vehicleType as VehicleType)
      : undefined;

  const db = adminDb();
  const negotiationRef = db.collection("negotiations").doc(negotiationId);
  const snapshot = await negotiationRef.get();
  if (!snapshot.exists) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const negotiation = shapeNegotiation(snapshot.id, snapshot.data()!);

  // Session-derived. This is what stops a buyer calling a lorry to somebody
  // else's farm.
  const party = partyFor(
    negotiation,
    gate.session.claims.role,
    gate.session.claims.accountId,
  );
  if (party !== "farmer") {
    return Response.json(
      { error: "Only the farmer on this bargain can call a vehicle.", code: "notAParty" },
      { status: 403 },
    );
  }

  if (negotiation.status !== "agreed") {
    return Response.json(
      {
        error: "Settle the price first. A vehicle is called once a bargain is agreed.",
        code: "notAgreed",
      },
      { status: 409 },
    );
  }

  const farmer = await readFarmer(gate.session.claims.accountId ?? "");
  if (!farmer) return Response.json({ error: "Account not found." }, { status: 404 });

  const now = new Date();

  /*
    One live request per bargain, enforced by the document id rather than by a
    query — `create` on a fixed id is atomic, where "read then write" leaves a
    gap two taps can both get through. A finished request is replaced, because a
    farmer whose search timed out must be able to try again.
  */
  const ref = db.collection("pickups").doc(negotiationId);
  const existing = await ref.get();

  if (existing.exists) {
    const status = existing.data()?.status;
    const live =
      status === "accepted" ||
      (status === "searching" && now.getTime() < (existing.data()?.expiresAt?.toDate?.()?.getTime() ?? 0));

    if (live) {
      return Response.json(
        {
          error:
            status === "accepted"
              ? "A vehicle has already accepted this load."
              : "You already have a request out for this load.",
          code: "alreadyRequested",
        },
        { status: 409 },
      );
    }
  }

  const quantity = agreedQuantity(negotiation);

  await ref.set({
    negotiationId,
    farmerId: negotiation.farmerId,
    farmerName: negotiation.farmerName,
    produceName: negotiation.produceName,
    // The agreed share, not the listed lot. A field sold in three parts calls
    // three vehicles, each for what that buyer actually took.
    quantity,
    unit: negotiation.unit,
    pickupDistrict: farmer.district,
    pickupVillage: farmer.village ?? null,
    wantedType: wantedType ?? null,
    // Nothing on the platform yet records which crops must travel cold at the
    // bargain level, so this is false until shelf life is wired through. Stored
    // explicitly rather than omitted, so the day it matters there is a field to
    // set rather than a shape to change.
    needsRefrigeration: false,
    status: "searching",
    requestedAt: now,
    expiresAt: new Date(now.getTime() + PICKUP_WINDOW_MINUTES * 60_000),
    acceptedBy: null,
  });

  return Response.json(
    {
      id: ref.id,
      status: "searching",
      quantity,
      unit: negotiation.unit,
      expiresInMinutes: PICKUP_WINDOW_MINUTES,
    },
    { status: 201 },
  );
}
