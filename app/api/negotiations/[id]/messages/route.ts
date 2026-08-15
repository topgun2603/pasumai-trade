import { GRADES } from "@/lib/domain/enums";
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

/** Rates arrive as `{ a: 2200, b: 1800, c: 1300 }` in paise. */
function readBands(value: unknown): GradeBand[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;

  const bands: GradeBand[] = [];
  for (const grade of GRADES) {
    const rate = source[grade];
    if (typeof rate !== "number" || !Number.isFinite(rate)) continue;
    // Paise are integers. A fractional rate would put a fraction of a paisa
    // into a money calculation that is integer all the way down.
    bands.push({ grade, ratePerUnit: Math.round(rate) });
  }
  return bands.length > 0 ? bands : undefined;
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

  const text = typeof body.text === "string" ? body.text.trim() : undefined;
  if (kind === "note" && !text) {
    return Response.json({ error: "A message needs some text." }, { status: 422 });
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

  const sentAt = new Date();

  const draft: DraftMessage = {
    // Sequential rather than random: the id says where in the thread it sits,
    // which matters when reading a bargain back as a commercial record.
    id: `${id}-M${negotiation.messages.length + 1}`,
    author,
    kind,
    text,
    locale: typeof body.locale === "string" ? body.locale : undefined,
    bands: kind === "proposal" ? readBands(body.bands) : undefined,
    validForMinutes:
      typeof body.validForMinutes === "number" ? body.validForMinutes : undefined,
    sentAt,
  };

  let next;
  try {
    next = applyMessage(negotiation, draft);
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
      agreedBands: next.agreedBands ?? null,
      agreedAt: next.agreedAt ?? null,
      messages: next.messages.map((m) => ({
        id: m.id,
        author: m.author,
        kind: m.kind,
        text: m.text ?? null,
        locale: m.locale ?? null,
        bands: m.bands ?? null,
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
