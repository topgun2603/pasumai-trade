import { requireCapability } from "@/lib/api/capability";
import { canRequest, requestDispatch, type DispatchRequest } from "@/lib/domain/dispatch-request";
import { partyFor } from "@/lib/domain/negotiation";
import { adminDb } from "@/lib/firebase/admin";
import { readFarmer } from "@/lib/firebase/farmer-read";
import { shapeNegotiation } from "@/lib/firebase/negotiations-read";
import { agencies } from "@/lib/mock/admin";

/**
 * The farmer hands a settled lot to a transport agency.
 *
 * Gated on `bargain` rather than a capability of its own: arranging the lorry
 * is part of concluding the sale, and a farmer who could bargain but not
 * dispatch would have agreed a price they cannot deliver on.
 *
 * The party is derived from the session, exactly as it is for a message. A
 * buyer cannot arrange the farmer's transport and a stranger cannot arrange
 * anybody's — `partyFor` returns null and this refuses, without the request
 * getting to say who it is.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/negotiations/[id]/transport">,
) {
  const gate = await requireCapability("bargain", "farmer");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  let body: { agencyId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const agencyId = typeof body.agencyId === "string" ? body.agencyId : "";
  if (!agencyId) return Response.json({ error: "Choose an agency." }, { status: 422 });

  const db = adminDb();
  const ref = db.collection("negotiations").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return Response.json({ error: "Not found." }, { status: 404 });

  const negotiation = shapeNegotiation(snapshot.id, snapshot.data()!);

  // Session-derived. This is the line that stops a buyer arranging a farmer's
  // lorry, or anyone else arranging either.
  const party = partyFor(
    negotiation,
    gate.session.claims.role,
    gate.session.claims.accountId,
  );
  if (party !== "farmer") {
    return Response.json(
      { error: "Only the farmer on this bargain can arrange transport.", code: "notAParty" },
      { status: 403 },
    );
  }

  const now = new Date();
  const [farmer, agency] = await Promise.all([
    readFarmer(gate.session.claims.accountId ?? ""),
    Promise.resolve(agencies(now).find((a) => a.id === agencyId)),
  ]);

  if (!farmer) return Response.json({ error: "Account not found." }, { status: 404 });
  if (!agency) return Response.json({ error: "No such agency." }, { status: 404 });

  const existing = (snapshot.data()!.transport ?? null) as DispatchRequest | null;

  const allowed = canRequest({
    negotiation,
    agency,
    existing,
    pickupDistrict: farmer.district,
    now: now.getTime(),
  });

  if (!allowed.ok) {
    // The domain's refusal is written to be read by the farmer who tried it,
    // so it goes back as-is.
    return Response.json({ error: allowed.message, code: allowed.code }, { status: 409 });
  }

  const dispatch = requestDispatch(negotiation, agency, farmer.district, now);

  await ref.set(
    {
      transport: {
        negotiationId: dispatch.negotiationId,
        agencyId: dispatch.agencyId,
        agencyName: dispatch.agencyName,
        status: dispatch.status,
        requestedAt: dispatch.requestedAt,
        respondedAt: null,
        pickupDistrict: dispatch.pickupDistrict,
        reason: null,
        // The agreed share, not the listed lot. Three buyers on one field means
        // three of these, each for what that buyer actually took.
        produceName: dispatch.produceName,
        quantity: dispatch.quantity,
        unit: dispatch.unit,
      },
      updatedAt: now,
    },
    { merge: true },
  );

  return Response.json(
    {
      negotiationId: id,
      agencyId: agency.id,
      agencyName: agency.name,
      status: dispatch.status,
      quantity: dispatch.quantity,
      unit: dispatch.unit,
    },
    { status: 201 },
  );
}

/** The farmer withdrawing a request the agency has not answered. */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/negotiations/[id]/transport">,
) {
  const gate = await requireCapability("bargain", "farmer");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const ref = adminDb().collection("negotiations").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return Response.json({ error: "Not found." }, { status: 404 });

  const negotiation = shapeNegotiation(snapshot.id, snapshot.data()!);
  const party = partyFor(negotiation, gate.session.claims.role, gate.session.claims.accountId);
  if (party !== "farmer") {
    return Response.json({ error: "Not your bargain." }, { status: 403 });
  }

  const existing = (snapshot.data()!.transport ?? null) as DispatchRequest | null;
  if (!existing) return Response.json({ error: "Nothing to cancel." }, { status: 409 });

  if (existing.status === "accepted") {
    // Once an agency has committed a vehicle, cancelling is a conversation and
    // not a button — they may already be on the road.
    return Response.json(
      { error: "That agency has already accepted. Phone them to stand it down." },
      { status: 409 },
    );
  }

  await ref.set(
    { transport: { ...existing, status: "cancelled", respondedAt: new Date() } },
    { merge: true },
  );

  return Response.json({ negotiationId: id, status: "cancelled" });
}
