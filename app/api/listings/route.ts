import { requireCapability } from "@/lib/api/capability";
import { formatQuantity } from "@/lib/domain/quantity";
import { GRADES, type Grade } from "@/lib/domain/enums";
import {
  hasDraftErrors,
  isQuantityUnit,
  MAX_IMAGES,
  offeredGrades,
  totalQuantity,
  validateDraft,
  type GradeQuantity,
} from "@/lib/domain/listing-draft";
import { record } from "@/lib/firebase/audit-write";
import { adminDb } from "@/lib/firebase/admin";
import { CATALOGUE } from "@/lib/mock/catalogue";

/**
 * Post produce.
 *
 * Farmers only, and only with an active plan and a cleared verification —
 * `requireCapability` answers 403 or 402 and the dialog keys its prompts off
 * which.
 *
 * The farmer is taken from the session, never from the body. A listing that
 * could name its own farmer would let anyone post produce in somebody else's
 * name and collect the bargains for it.
 *
 * Media arrives as storage paths, not as bytes: the browser has already
 * uploaded straight to the bucket using a URL this server signed. The paths
 * are checked to be inside the farmer's own folder, because a path is the one
 * part of that exchange the client hands back.
 */

/** How long until it needs cutting, as hours. Kept coarse on purpose. */
const READY_HOURS: Record<string, number> = {
  today: 0,
  tomorrow: 24,
  "3days": 72,
  week: 168,
};

/**
 * `{ a: { quantity: 300, rate: 2600 } }` — grades the farmer has, any subset.
 *
 * The bare-number form `{ a: 300 }` is still accepted, because it is what the
 * first version of this endpoint took and there is no reason to break a client
 * that has not been updated.
 */
function readGrades(value: unknown): GradeQuantity[] {
  if (!value || typeof value !== "object") return [];
  const source = value as Record<string, unknown>;

  return GRADES.flatMap((grade) => {
    const raw = source[grade];

    const quantity =
      typeof raw === "number"
        ? raw
        : raw && typeof raw === "object" && typeof (raw as { quantity?: unknown }).quantity === "number"
          ? ((raw as { quantity: number }).quantity)
          : NaN;

    if (!Number.isFinite(quantity) || quantity <= 0) return [];

    const rateRaw =
      raw && typeof raw === "object" ? (raw as { rate?: unknown }).rate : undefined;
    const askingRate =
      typeof rateRaw === "number" && Number.isFinite(rateRaw) && rateRaw > 0
        ? // Paise are integers all the way down. A fractional paisa here
          // becomes a fractional paisa in every total computed from it.
          Math.round(rateRaw)
        : undefined;

    // Whole units. Half a kilo of grade B is not a thing anyone weighs out at
    // a farm gate, and a fraction here becomes a fraction in every total.
    return [{ grade: grade as Grade, quantity: Math.round(quantity), askingRate }];
  });
}

export async function POST(request: Request) {
  const gate = await requireCapability("postListing", "farmer");
  if (!gate.ok) return gate.response;

  const farmerId = gate.session.claims.accountId!;

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

  const grades = readGrades(body.grades);
  const readyIn = typeof body.readyIn === "string" ? body.readyIn : "today";

  // The farmer's choice, falling back to what the crop is usually sold in.
  const unit =
    typeof body.unit === "string" && isQuantityUnit(body.unit)
      ? body.unit
      : produce.defaultUnit;

  // Only paths under this farmer's own folder. The signing route composes
  // them, so anything else is a client that edited what it was handed.
  const prefix = `listings/${farmerId}/`;
  const asPaths = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((p): p is string => typeof p === "string" && p.startsWith(prefix))
      : [];

  const imagePaths = asPaths(body.imagePaths).slice(0, MAX_IMAGES);
  const videoCandidate = typeof body.videoPath === "string" ? body.videoPath : undefined;
  const videoPath = videoCandidate?.startsWith(prefix) ? videoCandidate : undefined;

  const errors = validateDraft({ produceId, unit, grades, readyIn, imagePaths, videoPath });
  if (hasDraftErrors(errors)) {
    const [field, message] = Object.entries(errors).find(([, m]) => m)!;
    return Response.json({ error: message, field }, { status: 422 });
  }

  const offered = offeredGrades(grades);
  const now = new Date();
  const ref = adminDb().collection("listings").doc();

  await ref.set({
    produceId: produce.id,
    // Denormalised so the market can render a row without a catalogue lookup,
    // and so a crop renamed later does not rewrite history.
    produceName: produce.names.en,
    // From the session. This is the line that makes the listing theirs.
    farmerId,
    // Per grade, and only the grades they actually have.
    grades: offered.map((g) => ({
      grade: g.grade,
      quantity: g.quantity,
      // Null rather than omitted: Firestore rejects undefined, and an explicit
      // null reads as "no asking price" rather than as a missing field.
      askingRate: g.askingRate ?? null,
    })),
    // The sum, stored so a list can sort and filter on it without unpacking
    // the array on every row.
    quantity: totalQuantity(offered),
    unit,
    status: "awaitingOffer",
    readyAt: new Date(now.getTime() + (READY_HOURS[readyIn] ?? 0) * 3_600_000),
    createdAt: now,
    imagePaths,
    videoPath: videoPath ?? null,
    photoCount: imagePaths.length,
  });

  // The first entry in a listing's history, so the trail starts where the
  // listing does rather than at whoever edited it next.
  await record({
    action: "listing.created",
    actor: { accountId: farmerId, role: gate.session.claims.role, name: farmerId },
    subject: { kind: "listings", id: ref.id },
    to: `${produce.names.en} · ${formatQuantity(totalQuantity(offered), unit)}`,
    parties: [farmerId],
    at: now,
  });

  return Response.json(
    {
      id: ref.id,
      status: "awaitingOffer",
      grades: offered,
      quantity: totalQuantity(offered),
    },
    { status: 201 },
  );
}
