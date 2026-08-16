import { GRADES } from "@/lib/domain/enums";
import { canSay, phraseById } from "@/lib/domain/bargain-vocabulary";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
import type { GradeBand } from "@/lib/domain/models";
import {
  applyMessage,
  NegotiationError,
  type DraftMessage,
  type MessageKind,
  partyFor,
} from "@/lib/domain/negotiation";
import { adminDb } from "@/lib/firebase/admin";
import { shapeNegotiation } from "@/lib/firebase/negotiations-read";
import { readRemaining } from "@/lib/firebase/remaining-read";
import { requireCapability } from "@/lib/api/capability";

/**
 * Append a message to a bargain.
 *
 * The author is taken from the session, never from the request body, and the
 * guards run here against the document as it stands in Firestore. The client
 * runs the same functions to decide what to enable, but that is a courtesy to
 * the person using it — a client that is stale because the other side just
 * countered must not be able to talk this endpoint into a price nobody agreed
 * to.
 */
const KINDS: MessageKind[] = ["note", "proposal", "accept", "withdraw"];

/**
 * Rates arrive as `{ a: 2200, b: 1800 }` in paise, quantities as `{ a: 200 }`.
 *
 * Keyed by grade rather than sent as an array, so a reordered list cannot
 * quietly reprice the wrong grade. A grade with a quantity but no rate is not a
 * bid and is dropped; a grade with a rate and no quantity is a bid for whatever
 * is available, which is what a whole-lot offer has always been.
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
    if (typeof rate !== "number" || !Number.isFinite(rate)) continue;

    const quantity = wanted[grade];
    bands.push({
      // Paise are integers. A fractional rate would put a fraction of a paisa
      // into a money calculation that is integer all the way down.
      ratePerUnit: Math.round(rate),
      grade,
      // Left undefined rather than defaulted, so "no quantity given" stays
      // distinguishable from "asked for zero" — the guard refuses the latter.
      quantity:
        typeof quantity === "number" && Number.isFinite(quantity)
          ? Math.round(quantity)
          : undefined,
    });
  }
  return bands.length > 0 ? bands : undefined;
}

/**
 * Bands, ready for Firestore.
 *
 * Firestore refuses `undefined` outright — it is not "absent", it is an error —
 * and a band read back from a message written before lots could be split has
 * exactly that for its quantity. Since appending a message rewrites the whole
 * thread, one legacy band anywhere in the history made *every* further message
 * on that thread fail with a 500. Written as an explicit null instead, which
 * reads back as `undefined` and still means "all of that grade".
 */
function writeBands(
  bands: readonly GradeBand[] | undefined,
): Array<Record<string, unknown>> | null {
  if (!bands) return null;
  return bands.map((b) => ({
    grade: b.grade,
    ratePerUnit: b.ratePerUnit,
    quantity: b.quantity ?? null,
  }));
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/negotiations/[id]/messages">,
) {
  // Operations are deliberately not permitted here. They may read a bargain;
  // they may not speak in one.
  //
  // Bargaining is a paid capability, so the same call also checks the
  // subscription and answers 402 if it is missing. Reading a bargain stays
  // free — it is speaking in one that costs.
  const gate = await requireCapability("bargain", "farmer", "buyer", "franchise");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const kind = body.kind as MessageKind;
  if (!KINDS.includes(kind)) {
    return Response.json({ error: "Unknown message kind." }, { status: 422 });
  }

  // What is said comes from the vocabulary operations maintain, by id.
  // `body.text` is read nowhere — a request carrying `{ phraseId:
  // "collect-today", text: "call me on 98430 11204" }` gets the words that
  // belong to that id and nothing else, which is the whole point of the list.
  //
  // Read from Firestore rather than the compiled constant, so a phrase added
  // in Controls this morning is sayable this morning. Same source the picker
  // uses; if these two disagreed, every new phrase would be a 422.
  const phraseId = typeof body.phraseId === "string" ? body.phraseId : undefined;
  const { vocabulary } = await readBargainVocabulary();
  const phrase = phraseId ? phraseById(vocabulary, phraseId) : undefined;

  if (phraseId && !phrase) {
    return Response.json(
      { error: "That is not a phrase you can send.", code: "unknownPhrase" },
      { status: 422 },
    );
  }

  if (kind === "note" && !phrase) {
    return Response.json(
      { error: "Choose a message from the list.", code: "noPhrase" },
      { status: 422 },
    );
  }

  const db = adminDb();
  const ref = db.collection("negotiations").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const negotiation = shapeNegotiation(snapshot.id, snapshot.data()!);

  // Derived from the session, never read from the body. This is the line that
  // decides whether someone can accept a price on a farmer's behalf.
  const author = partyFor(
    negotiation,
    gate.session.claims.role,
    gate.session.claims.accountId,
  );
  if (!author) {
    return Response.json(
      { error: "You are not a party to this bargain.", code: "notAParty" },
      { status: 403 },
    );
  }

  // A farmer does not say "we will collect tomorrow" and a buyer does not say
  // "I cannot split this lot". Checked against the session-derived party, not
  // against anything the body claims to be.
  if (phrase && !canSay(vocabulary, author, phrase.id)) {
    return Response.json(
      {
        error: phrase.active
          ? "That message is not one your side sends."
          : "That message is no longer offered.",
        code: phrase.active ? "wrongSpeaker" : "retiredPhrase",
      },
      { status: 422 },
    );
  }

  const sentAt = new Date();

  // What is left on the lot, so a bid for part of it can be bounded. Read here
  // rather than trusted from the client: the whole reason quantities are
  // checked is that another buyer may have taken the rest while this screen was
  // open.
  const remaining =
    kind === "proposal" ? await readRemaining(negotiation.listingId) : undefined;

  const draft: DraftMessage = {
    // Sequential rather than random: the id says where in the thread it sits,
    // which matters when reading a bargain back as a commercial record.
    id: `${id}-M${negotiation.messages.length + 1}`,
    author,
    kind,
    phraseId: phrase?.id,
    // Stored from the vocabulary, never from the body.
    text: phrase?.text.en,
    locale: typeof body.locale === "string" ? body.locale : undefined,
    bands: kind === "proposal" ? readBands(body.bands, body.quantities) : undefined,
    validForMinutes:
      typeof body.validForMinutes === "number" ? body.validForMinutes : undefined,
    sentAt,
  };

  let next;
  try {
    next = applyMessage(negotiation, draft, remaining);
  } catch (error) {
    if (error instanceof NegotiationError) {
      // The domain's refusal text is written to be read by the person who
      // attempted it, so it goes back verbatim rather than being reworded.
      return Response.json({ error: error.message, code: error.code }, { status: 409 });
    }
    throw error;
  }

  await ref.set(
    {
      status: next.status,
      agreedBands: writeBands(next.agreedBands),
      agreedAt: next.agreedAt ?? null,
      // The whole thread is rewritten on every append, so this maps *old*
      // messages too — including ones written before bands carried a quantity.
      messages: next.messages.map((m) => ({
        id: m.id,
        author: m.author,
        kind: m.kind,
        phraseId: m.phraseId ?? null,
        text: m.text ?? null,
        locale: m.locale ?? null,
        bands: writeBands(m.bands),
        expiresAt: m.expiresAt ?? null,
        sentAt: m.sentAt,
      })),
      updatedAt: sentAt,
    },
    { merge: true },
  );

  // Agreement is binding, so this is where the procurement order gets created.
  // Left as an explicit gap rather than a silent one: creating an order needs
  // the listing, the farmer's account and a verified buyer, and wiring that
  // before auth exists would mean trusting the body's `author` with money.
  const orderPending = next.status === "agreed";

  return Response.json({
    id: next.id,
    status: next.status,
    messageCount: next.messages.length,
    orderPending,
  });
}
