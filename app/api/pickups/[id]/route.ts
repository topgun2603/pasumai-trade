import { requireCapability } from "@/lib/api/capability";
import { cancel } from "@/lib/domain/pickup-request";
import { adminDb } from "@/lib/firebase/admin";
import { shapePickup } from "@/lib/firebase/pickup-read";

/**
 * The farmer calling off a search nobody has answered.
 *
 * In a transaction for the same reason accepting is: a driver may be tapping
 * Accept at the moment the farmer taps Cancel, and exactly one of them has to
 * win. If the driver got there first the farmer is told a vehicle is already
 * coming and to phone them — somebody may already be on the road, and a
 * cancellation the driver never hears about is a wasted trip.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/pickups/[id]">,
) {
  const gate = await requireCapability("bargain", "farmer");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const db = adminDb();
  const ref = db.collection("pickups").doc(id);

  try {
    const outcome = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { missing: true as const };

      const pickup = shapePickup(snapshot.id, snapshot.data()!);

      // Theirs, checked against the session rather than the request.
      if (pickup.farmerId !== gate.session.claims.accountId) {
        return { forbidden: true as const };
      }

      const result = cancel(pickup);
      if (!result.ok) return { result };

      transaction.update(ref, { status: "cancelled" });
      return { result };
    });

    if ("missing" in outcome) {
      return Response.json({ error: "Nothing to cancel." }, { status: 404 });
    }
    if ("forbidden" in outcome) {
      return Response.json({ error: "Not your request." }, { status: 403 });
    }
    if (!outcome.result.ok) {
      return Response.json(
        { error: outcome.result.message, code: outcome.result.code },
        { status: 409 },
      );
    }

    return Response.json({ id, status: "cancelled" });
  } catch (error) {
    console.error("pickup cancel failed", { id, error });
    return Response.json({ error: "Could not cancel that." }, { status: 500 });
  }
}
