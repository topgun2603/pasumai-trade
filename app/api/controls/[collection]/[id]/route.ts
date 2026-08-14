import { adminDb } from "@/lib/firebase/admin";
import { writeGuard } from "@/lib/api/write-guard";
import {
  DEPENDENTS,
  isDeletable,
  isEditable,
  validate,
} from "@/lib/domain/controls";

/**
 * Update or delete a reference-data record.
 *
 * Same caveat as the create handler: **not protected yet**. See `writeGuard`,
 * which closes both in production and is the one place `verifySession()` goes.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/controls/[collection]/[id]">,
) {
  const blocked = writeGuard();
  if (blocked) return blocked;

  const { collection, id } = await context.params;
  if (!isEditable(collection)) {
    return Response.json({ error: "Unknown collection." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection(collection).doc(id);
  const existing = await ref.get();
  if (!existing.exists) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  // Validated against the merged record, so a partial edit cannot leave the
  // document in a shape that would have been rejected on create.
  const result = validate(collection, { ...existing.data(), ...body, id });
  if (!result.ok || !result.data) {
    return Response.json({ error: result.errors.join(" ") }, { status: 422 });
  }

  await ref.set({ ...result.data, updatedAt: new Date() }, { merge: true });

  return Response.json({ id, ...result.data });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/controls/[collection]/[id]">,
) {
  const blocked = writeGuard();
  if (blocked) return blocked;

  const { collection, id } = await context.params;
  if (!isEditable(collection)) {
    return Response.json({ error: "Unknown collection." }, { status: 404 });
  }

  if (!isDeletable(collection)) {
    return Response.json(
      {
        error:
          "This record cannot be deleted — everything on the platform reads it, and deleting it would silently revert to shipped defaults. Edit it instead.",
      },
      { status: 409 },
    );
  }

  const db = adminDb();
  const ref = db.collection(collection).doc(id);

  // Firestore treats deleting a missing document as a success, which would let
  // the console report "deleted" for a record another admin removed a moment
  // earlier — or for an id that never existed.
  if (!(await ref.get()).exists) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  // Refuse rather than cascade. Reference data is referenced by definition,
  // and a cascade here would delete trade records to satisfy a tidy-up.
  for (const dependent of DEPENDENTS[collection]) {
    const blockers = await db
      .collection(dependent.collection)
      .where(dependent.field, "==", id)
      .limit(5)
      .get();

    if (!blockers.empty) {
      return Response.json(
        {
          error: `Still used by ${blockers.size}${blockers.size === 5 ? "+" : ""} ${dependent.label}${blockers.size === 1 ? "" : "s"}. Deactivate it instead — that hides it from every dropdown without breaking existing records.`,
        },
        { status: 409 },
      );
    }
  }

  await ref.delete();

  return Response.json({ id, deleted: true });
}
