import { requireCapability } from "@/lib/api/capability";
import { GRADES, type Grade } from "@/lib/domain/enums";
import {
  isQuantityUnit,
  MAX_IMAGES,
  offeredGrades,
  totalQuantity,
  type GradeQuantity,
} from "@/lib/domain/listing-draft";
import { formatMoney, money } from "@/lib/domain/money";
import { formatQuantity } from "@/lib/domain/quantity";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { record } from "@/lib/firebase/audit-write";
import { CATALOGUE } from "@/lib/mock/catalogue";

/**
 * Edit and remove a listing.
 *
 * Ownership is checked against the session on every call, never against
 * anything in the URL beyond the document id — the id says *which* listing, the
 * session says whether it is yours. Getting that the wrong way round is how one
 * farmer edits another's produce.
 *
 * Withdrawing and deleting are different acts and both exist. Withdraw takes it
 * off the market and keeps the record, which is what a farmer wants when the
 * lot went elsewhere and a buyer may still ask about it. Delete removes it and
 * its photographs, for the listing posted by mistake.
 */

const READY_HOURS: Record<string, number> = {
  today: 0,
  tomorrow: 24,
  "3days": 72,
  week: 168,
};

/** "500 kg", for a history row. Tolerant, because this reads stored data. */
function describeQuantity(quantity: unknown, unit: unknown): string {
  if (typeof quantity !== "number") return "—";
  return formatQuantity(quantity, typeof unit === "string" ? unit : "");
}

/**
 * The asking rates as one line, so two of them can be compared.
 *
 * A per-grade diff would be more precise and much harder to read back; what a
 * dispute needs is "A ₹25, B ₹20" against "A ₹22, B ₹20", which shows both the
 * change and what was left alone.
 */
function ratesOf(grades: unknown): string {
  if (!Array.isArray(grades)) return "—";
  const parts = grades
    .filter((g): g is { grade: string; askingRate?: number | null } => Boolean(g))
    .map((g) =>
      typeof g.askingRate === "number"
        ? `${String(g.grade).toUpperCase()} ${formatMoney(money(g.askingRate))}`
        : `${String(g.grade).toUpperCase()} —`,
    );
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Same two shapes the POST route takes: a bare number, or quantity plus rate. */
function readGrades(value: unknown): GradeQuantity[] {
  if (!value || typeof value !== "object") return [];
  const source = value as Record<string, unknown>;

  return GRADES.flatMap((grade) => {
    const raw = source[grade];
    const quantity =
      typeof raw === "number"
        ? raw
        : raw && typeof raw === "object" && typeof (raw as { quantity?: unknown }).quantity === "number"
          ? (raw as { quantity: number }).quantity
          : NaN;
    if (!Number.isFinite(quantity) || quantity <= 0) return [];

    const rateRaw = raw && typeof raw === "object" ? (raw as { rate?: unknown }).rate : undefined;
    const askingRate =
      typeof rateRaw === "number" && Number.isFinite(rateRaw) && rateRaw > 0
        ? Math.round(rateRaw)
        : undefined;

    return [{ grade: grade as Grade, quantity: Math.round(quantity), askingRate }];
  });
}

/** The listing, if it exists and belongs to whoever is asking. */
async function mine(id: string, farmerId: string) {
  const ref = adminDb().collection("listings").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { ref, data: null as Record<string, unknown> | null };

  const data = snapshot.data()!;
  // Case-insensitive, because seeded rows spell the id in lower case while
  // account ids are upper.
  const owner = typeof data.farmerId === "string" ? data.farmerId.toLowerCase() : "";
  if (owner !== farmerId.toLowerCase()) return { ref, data: null };

  return { ref, data };
}

export async function PATCH(request: Request, context: RouteContext<"/api/listings/[id]">) {
  const gate = await requireCapability("postListing", "farmer");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const farmerId = gate.session.claims.accountId!;
  const { ref, data } = await mine(id, farmerId);

  // One answer for "no such listing" and "not yours". Telling them apart would
  // confirm which ids exist to anyone who asks.
  if (!data) return Response.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.grades !== undefined) {
    const grades = offeredGrades(readGrades(body.grades));
    if (grades.length === 0) {
      return Response.json(
        { error: "Keep at least one grade. Withdraw the listing instead of emptying it." },
        { status: 422 },
      );
    }
    update.grades = grades.map((g) => ({
      grade: g.grade,
      quantity: g.quantity,
      askingRate: g.askingRate ?? null,
    }));
    update.quantity = totalQuantity(grades);
  }

  // The unit is the farmer's, not the crop's. Changing it does not rescale the
  // quantities — 300 kg is not 300 crates, and quietly converting somebody's
  // stock is worse than making them retype it.
  if (typeof body.unit === "string" && isQuantityUnit(body.unit)) {
    update.unit = body.unit;
  }

  if (typeof body.readyIn === "string" && body.readyIn in READY_HOURS) {
    update.readyAt = new Date(Date.now() + READY_HOURS[body.readyIn] * 3_600_000);
  }

  /*
    The crop.

    Allowed, with the record following: `produceName` and `unit` are stored
    denormalised on the listing, so changing the crop and leaving those behind
    would give a row reading "Tomato" that is actually onions in every list on
    the platform.

    Worth knowing this is not free — a buyer part-way through a bargain priced
    against what was there when they opened it. The dialog says so when a
    bargain is live; it does not refuse, because the farmer knows what they
    posted and a typo on the crop is otherwise permanent.
  */
  if (typeof body.produceId === "string" && body.produceId) {
    const produce = Object.values(CATALOGUE).find((p) => p.id === body.produceId);
    if (!produce) return Response.json({ error: "Unknown crop." }, { status: 422 });
    update.produceId = produce.id;
    update.produceName = produce.names.en;
    // The unit deliberately does not follow the crop here: the farmer set it,
    // and an explicit `unit` in the same request wins anyway.
    if (update.unit === undefined && typeof body.unit !== "string") {
      update.unit = produce.defaultUnit;
    }
  }

  /*
    Media.

    Sent whole rather than as add/remove operations: the client already knows
    the full set it wants, and a diff computed in two places is a diff that
    disagrees with itself. Paths outside this farmer's folder are dropped, the
    same as when posting.
  */
  const prefix = `listings/${farmerId}/`;
  let removed: string[] = [];

  if (Array.isArray(body.imagePaths)) {
    const next = body.imagePaths
      .filter((p): p is string => typeof p === "string" && p.startsWith(prefix))
      .slice(0, MAX_IMAGES);

    if (next.length === 0) {
      return Response.json(
        { error: "Keep at least one photo. Buyers decide on the pictures." },
        { status: 422 },
      );
    }

    const before = Array.isArray(data.imagePaths)
      ? data.imagePaths.filter((p): p is string => typeof p === "string")
      : [];
    removed = before.filter((p) => !next.includes(p));

    update.imagePaths = next;
    update.photoCount = next.length;
  }

  if (body.videoPath !== undefined) {
    const next =
      typeof body.videoPath === "string" && body.videoPath.startsWith(prefix)
        ? body.videoPath
        : null;
    const before = typeof data.videoPath === "string" ? data.videoPath : null;
    if (before && before !== next) removed.push(before);
    update.videoPath = next;
  }

  if (body.status === "withdrawn" || body.status === "awaitingOffer") {
    // Only these two. A farmer cannot mark their own listing sold or agreed —
    // those follow from a bargain, and letting the seller set them by hand
    // would make the trail meaningless.
    update.status = body.status;
  }

  if (Object.keys(update).length === 1) {
    return Response.json({ error: "Nothing to change." }, { status: 422 });
  }

  await ref.set(update, { merge: true });

  /*
    Bug 13: the history of what changed, written where the change happens.

    Quantity and price are the two the report names, because they are the two
    a dispute is ever about — "it said 500 this morning" needs an answer from
    a record neither side wrote. Recorded after the write, so a log entry can
    never claim a change that did not land, and `record` never throws: a
    bookkeeping failure must not fail the edit it was describing.
  */
  const actor = {
    accountId: farmerId,
    role: gate.session.claims.role,
    name: typeof data.farmerName === "string" ? data.farmerName : farmerId,
  };
  const subject = { kind: "listings", id };
  const at = new Date();

  if (update.quantity !== undefined && update.quantity !== data.quantity) {
    await record({
      action: "listing.quantityChanged",
      actor,
      subject,
      from: describeQuantity(data.quantity, data.unit),
      to: describeQuantity(update.quantity, update.unit ?? data.unit),
      at,
    });
  }

  if (update.grades !== undefined) {
    const before = ratesOf(data.grades);
    const after = ratesOf(update.grades);
    if (before !== after) {
      await record({
        action: "listing.priceChanged",
        actor,
        subject,
        from: before,
        to: after,
        at,
      });
    }
  }

  if (update.status === "withdrawn") {
    await record({ action: "listing.withdrawn", actor, subject, at });
  }

  // Photographs the farmer took out. Removed after the write, so a failure
  // here leaves an unreferenced object rather than a listing pointing at a
  // file that is gone.
  if (removed.length > 0) {
    const bucket = adminStorage();
    await Promise.all(
      removed.map(async (path) => {
        try {
          await bucket.file(path).delete();
        } catch {
          /* already gone */
        }
      }),
    );
  }

  return Response.json({
    id,
    updated: Object.keys(update).filter((k) => k !== "updatedAt"),
    filesRemoved: removed.length,
  });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/listings/[id]">) {
  const gate = await requireCapability("postListing", "farmer");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const farmerId = gate.session.claims.accountId!;
  const { ref, data } = await mine(id, farmerId);
  if (!data) return Response.json({ error: "Not found." }, { status: 404 });

  // The photographs go with it. Leaving them would quietly accumulate storage
  // nobody can reach and nobody is paying attention to.
  const paths = [
    ...(Array.isArray(data.imagePaths)
      ? data.imagePaths.filter((p): p is string => typeof p === "string")
      : []),
    ...(typeof data.videoPath === "string" ? [data.videoPath] : []),
  ];

  if (paths.length > 0) {
    const bucket = adminStorage();
    await Promise.all(
      paths.map(async (path) => {
        // An object already gone is not a reason to fail the delete — the
        // listing is what the farmer asked to remove.
        try {
          await bucket.file(path).delete();
        } catch {
          /* already gone */
        }
      }),
    );
  }

  await ref.delete();

  return Response.json({ id, deleted: true, filesRemoved: paths.length });
}
