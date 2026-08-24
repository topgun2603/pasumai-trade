import { requireCapability } from "@/lib/api/capability";
import { formatMoney, money } from "@/lib/domain/money";
import { canSay, phraseById } from "@/lib/domain/bargain-vocabulary";
import { GRADES, type Grade } from "@/lib/domain/enums";
import type { GradeBand } from "@/lib/domain/models";
import { applyMessage, NegotiationError } from "@/lib/domain/negotiation";
import { canStart, startNegotiation } from "@/lib/domain/negotiation-start";
import { record } from "@/lib/firebase/audit-write";
import { adminDb } from "@/lib/firebase/admin";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
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

/**
 * Rates arrive as `{ a: 2200 }` in paise and quantities as `{ a: 200 }`, the
 * same shape as a reply.
 *
 * A grade with a quantity and no rate is not an offer and is dropped; a grade
 * with a rate and no quantity is an offer for all of what is available, which
 * is what an opening offer has always meant.
 */
function readBands(value: unknown, quantities: unknown): GradeBand[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rates = value as Record<string, unknown>;
  const wanted =
    quantities && typeof quantities === "object"
      ? (quantities as Record<string, unknown>)
      : {};

  const bands: GradeBand[] = [];
  for (const grade of GRADES) {
    const rate = rates[grade];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;

    const quantity = wanted[grade];
    bands.push({
      grade: grade as Grade,
      // Paise are integers. A fractional rate puts a fraction of a paisa into
      // every total computed from it.
      ratePerUnit: Math.round(rate),
      // Passed through unrounded, unlike the rate. A fractional paisa is
      // meaningless so rounding it is safe; a fractional quantity is somebody
      // asking for 12.5 kg, and quietly turning that into 13 changes a
      // commercial term without telling them. The guard refuses it instead.
      //
      // Left undefined where none was given, so "no quantity" stays
      // distinguishable from "asked for zero" — which the guard also refuses.
      quantity:
        typeof quantity === "number" && Number.isFinite(quantity) ? quantity : undefined,
    });
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

  const bands = readBands(body.bands, body.quantities);

  // An opening message comes from the vocabulary, by id, exactly as every later
  // one does. `body.text` is read nowhere — the first message on a thread is
  // where a phone number would be most useful to somebody who wanted the trade
  // off the platform, so it is the last place to accept free text.
  const phraseId = typeof body.phraseId === "string" ? body.phraseId : undefined;
  const { vocabulary } = await readBargainVocabulary();
  const phrase = phraseId ? phraseById(vocabulary, phraseId) : undefined;

  if (phraseId && !canSay(vocabulary, "buyer", phraseId)) {
    return Response.json(
      { error: "That is not a message you can send.", code: "unknownPhrase" },
      { status: 422 },
    );
  }

  // A thread with nothing in it is not an opening move — the farmer would be
  // notified of a bargain that says nothing. Refused rather than created empty,
  // which is what a body carrying only free text used to produce: the text was
  // correctly ignored, and the buyer got a silent thread they thought carried
  // their message.
  if (!bands && !phrase) {
    return Response.json(
      {
        error: "Offer a price on at least one grade, or pick a message.",
        code: "emptyOpening",
      },
      { status: 422 },
    );
  }

  try {
    negotiation = applyMessage(
      negotiation,
      {
        id: `${ref.id}-M1`,
        // From the session's role, not from the body. A request claiming to be
        // the farmer would be a buyer speaking in the farmer's voice.
        author: "buyer",
        kind: bands ? "proposal" : "note",
        phraseId: phrase?.id,
        // Resolved from the vocabulary, never taken from the body.
        text: phrase?.text.en,
        bands,
        sentAt: now,
      },
      // What is left on the lot. `readMarketListings` already subtracts every
      // agreed bargain, so the grades on the listing *are* the remainder — and
      // a bid for more than that is refused here rather than discovered when
      // the farmer tries to accept it.
      listing.grades,
    );
  } catch (error) {
    if (error instanceof NegotiationError) {
      // The domain's refusal is written for the person who tried it.
      return Response.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
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
      phraseId: m.phraseId ?? null,
      text: m.text ?? null,
      locale: m.locale ?? null,
      // Explicit nulls, never undefined: Firestore refuses undefined outright,
      // and a band with no quantity means all of that grade.
      bands:
        m.bands?.map((b) => ({
          grade: b.grade,
          ratePerUnit: b.ratePerUnit,
          quantity: b.quantity ?? null,
        })) ?? null,
      sentAt: m.sentAt,
    })),
  });

  /*
    The opening offer. Recorded like any other proposal so a thread's history
    starts where the thread does — the first price named is the one every later
    move is read against.
  */
  await record({
    action: "bargain.proposed",
    actor: {
      accountId: gate.session.claims.accountId,
      role: gate.session.claims.role,
      name: negotiation.buyerName,
    },
    subject: { kind: "negotiations", id: ref.id },
    to: bands
      ?.map((band) => `${band.grade.toUpperCase()} ${formatMoney(money(band.ratePerUnit))}`)
      .join(", "),
    note: negotiation.produceName,
    parties: [negotiation.farmerId, negotiation.buyerId],
    at: negotiation.openedAt,
  });

  return Response.json(
    { id: ref.id, listingId: listing.id, status: negotiation.status },
    { status: 201 },
  );
}
