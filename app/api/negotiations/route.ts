import { requireCapability } from "@/lib/api/capability";
import { GRADES, type Grade } from "@/lib/domain/enums";
import type { GradeBand } from "@/lib/domain/models";
import { applyMessage, NegotiationError } from "@/lib/domain/negotiation";
import { canStart, startNegotiation } from "@/lib/domain/negotiation-start";
import { adminDb } from "@/lib/firebase/admin";
import { readMarketListings } from "@/lib/firebase/listings-read";
import { shapeNegotiation } from "@/lib/firebase/negotiations-read";

/**
 * A buyer opens a bargain on a listing.
 *
 * The first move nobody had: every thread on the platform was seeded, so a
 * buyer could answer a bargain but never begin one. A farmer posts what they
 * have and what they are asking; this is the buyer saying something about it.
 *
 * An opening offer is optional and, when given, is applied through
 * `applyMessage` exactly as a later proposal would be. That matters more than
 * it looks: a first offer written straight into the document would be the one
 * proposal on the platform that skipped the ordering and expiry rules.
 */

/** Rates arrive as `{ a: 2200, b: 1800 }` in paise, the same shape as a reply. */
function readBands(value: unknown): GradeBand[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;

  const bands: GradeBand[] = [];
  for (const grade of GRADES) {
    const rate = source[grade];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;
    // Paise are integers. A fractional rate puts a fraction of a paisa into
    // every total computed from it.
    bands.push({ grade: grade as Grade, ratePerUnit: Math.round(rate) });
  }
  return bands.length > 0 ? bands : undefined;
}

export async function POST(request: Request) {
  // Operations are deliberately absent: they may read a bargain, never open
  // one. Farmers cannot either — a farmer opening a bargain on their own
  // listing is the thing `canStart` refuses below, and on somebody else's it
  // is not a bargain at all.
  const gate = await requireCapability("bargain", "buyer", "franchise");
  if (!gate.ok) return gate.response;

  const buyerId = gate.session.claims.accountId!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  if (!listingId) return Response.json({ error: "Which listing?" }, { status: 422 });

  const db = adminDb();
  const [listings, threadsSnapshot, buyerDoc] = await Promise.all([
    readMarketListings(),
    db.collection("negotiations").where("buyerId", "==", buyerId).get(),
    db.collection("buyers").doc(buyerId).get(),
  ]);

  const listing = listings.find((l) => l.id === listingId);
  if (!listing) {
    return Response.json({ error: "That produce is not on the market." }, { status: 404 });
  }

  const existing = threadsSnapshot.docs.map((d) => shapeNegotiation(d.id, d.data()));

  const allowed = canStart({
    listing: {
      id: listing.id,
      produceName: listing.produceName,
      // The listing's own farmer, never a farmer named in the request.
      farmerId: listing.farmerId,
      farmerName: listing.farmerName,
      quantity: listing.quantity,
      unit: listing.unit as never,
      status: listing.status,
      grades: listing.grades,
    },
    buyerId,
    existing,
  });

  if (!allowed.ok) {
    return Response.json({ error: allowed.message, code: allowed.code }, { status: 409 });
  }

  const now = new Date();
  const ref = db.collection("negotiations").doc();

  let negotiation = startNegotiation({
    id: ref.id,
    listing: {
      id: listing.id,
      produceName: listing.produceName,
      farmerId: listing.farmerId,
      farmerName: listing.farmerName,
      quantity: listing.quantity,
      unit: listing.unit as never,
      status: listing.status,
      grades: listing.grades,
    },
    buyerId,
    buyerName:
      (typeof buyerDoc.data()?.name === "string" ? (buyerDoc.data()!.name as string) : "") ||
      "Buyer",
    now,
  });

  const bands = readBands(body.bands);
  const text = typeof body.text === "string" ? body.text.trim() : undefined;

  if (bands || text) {
    try {
      negotiation = applyMessage(negotiation, {
        id: `${ref.id}-M1`,
        // From the session's role, not from the body. A request claiming to be
        // the farmer would be a buyer speaking in the farmer's voice.
        author: "buyer",
        kind: bands ? "proposal" : "note",
        text,
        bands,
        sentAt: now,
      });
    } catch (error) {
      if (error instanceof NegotiationError) {
        // The domain's refusal is written for the person who tried it.
        return Response.json({ error: error.message, code: error.code }, { status: 409 });
      }
      throw error;
    }
  }

  await ref.set({
    listingId: negotiation.listingId,
    produceName: negotiation.produceName,
    farmerId: negotiation.farmerId,
    buyerId: negotiation.buyerId,
    farmerName: negotiation.farmerName,
    buyerName: negotiation.buyerName,
    quantity: negotiation.quantity,
    unit: negotiation.unit,
    status: negotiation.status,
    openedAt: negotiation.openedAt,
    updatedAt: now,
    agreedBands: negotiation.agreedBands ?? null,
    agreedAt: negotiation.agreedAt ?? null,
    messages: negotiation.messages.map((m) => ({
      id: m.id,
      author: m.author,
      kind: m.kind,
      text: m.text ?? null,
      locale: m.locale ?? null,
      bands: m.bands ?? null,
      expiresAt: m.expiresAt ?? null,
      sentAt: m.sentAt,
    })),
  });

  return Response.json(
    { id: ref.id, listingId: listing.id, status: negotiation.status },
    { status: 201 },
  );
}
