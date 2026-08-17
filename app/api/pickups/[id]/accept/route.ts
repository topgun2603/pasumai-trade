import { requireRole } from "@/lib/api/write-guard";
import { GEOGRAPHY } from "@/lib/mock/locations";
import { vehicles } from "@/lib/mock/admin";
import { readAgencies } from "@/lib/firebase/agency-read";
import { claim } from "@/lib/domain/pickup-request";
import { transportKey } from "@/lib/domain/notification-key";
import { adminDb } from "@/lib/firebase/admin";
import { shapeNegotiation } from "@/lib/firebase/negotiations-read";
import { writeNotifications } from "@/lib/firebase/notifications-write";
import { candidates, shapePickup } from "@/lib/firebase/pickup-read";
import { sendPushes } from "@/lib/firebase/push-send";

/**
 * A vehicle owner takes the job.
 *
 * **The whole feature turns on this handler being a race with exactly one
 * winner.** Two drivers tapping Accept in the same second is the ordinary case,
 * not the edge case, and a model where accepting sometimes means "you might
 * have it" is one drivers stop trusting immediately.
 *
 * So the read and the write happen inside a Firestore transaction. Reading the
 * request, deciding, and then writing without one leaves a window where both
 * drivers read `searching` and both write `accepted` — the second overwriting
 * the first, with two lorries dispatched and only one load.
 *
 * The vehicle is checked against the caller's own agency. Accepting on behalf
 * of a lorry that is not yours would let anyone with a transport account claim
 * every job on the platform and then not turn up.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/pickups/[id]/accept">,
) {
  // Transport accounts only. A buyer or a farmer has no vehicle to offer.
  const gate = await requireRole("transport", "admin");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  let body: { vehicleId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId : "";
  if (!vehicleId) return Response.json({ error: "Which vehicle?" }, { status: 422 });

  const now = new Date();

  const fleet = candidates({
    vehicles: vehicles(now),
    agencies: await readAgencies(now),
    places: GEOGRAPHY.places,
    now: now.getTime(),
  });

  const vehicle = fleet.find((candidate) => candidate.id === vehicleId);
  if (!vehicle) return Response.json({ error: "No such vehicle." }, { status: 404 });

  // Yours, or nobody's. Operations may accept on an agency's behalf — they field
  // the phone call when a driver cannot work the app.
  const accountId = gate.session.claims.accountId;
  if (gate.session.claims.role !== "admin" && vehicle.agencyId !== accountId) {
    return Response.json(
      { error: "That vehicle is not on your account.", code: "notYours" },
      { status: 403 },
    );
  }

  const db = adminDb();
  const ref = db.collection("pickups").doc(id);

  try {
    const outcome = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { missing: true as const };

      const pickup = shapePickup(snapshot.id, snapshot.data()!);
      const result = claim(pickup, vehicle, now.getTime());

      // Refusals leave the document untouched, which is what makes the loser's
      // read of it correct: it still says who won.
      if (!result.ok || !result.request) return { result };

      transaction.update(ref, {
        status: "accepted",
        acceptedBy: {
          vehicleId: vehicle.id,
          registration: vehicle.registration,
          vehicleType: vehicle.type,
          agencyId: vehicle.agencyId,
          agencyName: vehicle.agencyName,
          driverName: null,
          acceptedAt: now,
        },
      });

      return { result, pickup };
    });

    if ("missing" in outcome) {
      return Response.json({ error: "That request is gone." }, { status: 404 });
    }

    if (!outcome.result.ok) {
      return Response.json(
        { error: outcome.result.message, code: outcome.result.code },
        { status: 409 },
      );
    }

    /*
      Tell the farmer a vehicle is coming, and the buyer that their produce is
      moving. This is the one notification the old flow raised and the new one
      would otherwise have dropped: it used to be written when the farmer chose
      an agency, and now nothing happens at that moment — the farmer only asks.
      The event worth hearing about is the acceptance, which is here.
    */
    const pickup = outcome.pickup;
    if (pickup) {
      const thread = await db.collection("negotiations").doc(pickup.negotiationId).get();
      const negotiation = thread.exists
        ? shapeNegotiation(thread.id, thread.data()!)
        : null;

      const subject = {
        produceName: pickup.produceName,
        quantity: pickup.quantity,
        unit: pickup.unit,
        agencyName: vehicle.agencyName,
        negotiationId: pickup.negotiationId,
      };

      const drafts = [
        {
          id: transportKey(pickup.negotiationId, pickup.farmerId),
          accountId: pickup.farmerId,
          audience: "farmer" as const,
          kind: "transportArranged" as const,
          subject,
          href: "/farm/sales",
        },
        ...(negotiation
          ? [
              {
                id: transportKey(pickup.negotiationId, negotiation.buyerId),
                accountId: negotiation.buyerId,
                audience: "buyer" as const,
                kind: "transportArranged" as const,
                subject,
                href: "/bargains",
              },
            ]
          : []),
      ];

      await writeNotifications(drafts);
      await sendPushes(
        drafts.map((draft) => ({ ...draft, createdAt: now })),
        (audience) => (audience === "farmer" ? "ta" : "en"),
      );
    }

    return Response.json({
      id,
      status: "accepted",
      registration: vehicle.registration,
      agencyName: vehicle.agencyName,
    });
  } catch (error) {
    console.error("pickup claim failed", { id, vehicleId, error });
    return Response.json(
      { error: "Could not take that job. Try again." },
      { status: 500 },
    );
  }
}
