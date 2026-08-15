import { requireCapability } from "@/lib/api/capability";
import { adminDb } from "@/lib/firebase/admin";
import { CATALOGUE } from "@/lib/mock/catalogue";

/**
 * Post produce.
 *
 * Farmers only, and only with an active plan — `requireCapability` answers 402
 * when there is none, which is what the dialog keys its subscribe prompt off.
 *
 * The farmer is taken from the session, never from the body. A listing that
 * could name its own farmer would let anyone post produce in somebody else's
 * name and collect the bargains for it.
 */

/** How long until it needs cutting, as hours. Kept coarse on purpose. */
const READY_HOURS: Record<string, number> = {
  today: 0,
  tomorrow: 24,
  "3days": 72,
  week: 168,
};

export async function POST(request: Request) {
  const gate = await requireCapability("postListing", "farmer");
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const produceId = typeof body.produceId === "string" ? body.produceId : "";
  const produce = Object.values(CATALOGUE).find((p) => p.id === produceId);
  if (!produce) {
    return Response.json({ error: "Unknown crop." }, { status: 422 });
  }

  const quantity = typeof body.quantity === "number" ? body.quantity : NaN;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    return Response.json({ error: "Quantity must be a number above zero." }, { status: 422 });
  }

  const readyIn = typeof body.readyIn === "string" ? body.readyIn : "today";
  const readyHours = READY_HOURS[readyIn] ?? 0;

  const now = new Date();
  const db = adminDb();
  const ref = db.collection("listings").doc();

  await ref.set({
    produceId: produce.id,
    // Denormalised so the market can render a listing without a catalogue
    // lookup per row, and so a crop renamed later does not rewrite history.
    produceName: produce.names.en,
    // From the session. This is the line that makes the listing theirs.
    farmerId: gate.session.claims.accountId,
    quantity,
    unit: produce.defaultUnit,
    status: "awaitingOffer",
    readyAt: new Date(now.getTime() + readyHours * 3_600_000),
    createdAt: now,
    photoCount: 0,
  });

  return Response.json({ id: ref.id, status: "awaitingOffer" }, { status: 201 });
}
