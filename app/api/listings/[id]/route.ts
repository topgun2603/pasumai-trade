import { requireCapability } from "@/lib/api/capability";
import { GRADES, type Grade } from "@/lib/domain/enums";
import { offeredGrades, totalQuantity, type GradeQuantity } from "@/lib/domain/listing-draft";
import { adminDb, adminStorage } from "@/lib/firebase/admin";

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

function readGrades(value: unknown): GradeQuantity[] {
  if (!value || typeof value !== "object") return [];
  const source = value as Record<string, unknown>;
  return GRADES.flatMap((grade) => {
    const raw = source[grade];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return [];
    return [{ grade: grade as Grade, quantity: Math.round(raw) }];
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
    update.grades = grades.map((g) => ({ grade: g.grade, quantity: g.quantity }));
    update.quantity = totalQuantity(grades);
  }

  if (typeof body.readyIn === "string" && body.readyIn in READY_HOURS) {
    update.readyAt = new Date(Date.now() + READY_HOURS[body.readyIn] * 3_600_000);
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

  return Response.json({ id, updated: Object.keys(update).filter((k) => k !== "updatedAt") });
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
