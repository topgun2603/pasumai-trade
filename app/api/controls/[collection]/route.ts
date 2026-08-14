import { adminDb } from "@/lib/firebase/admin";
import { isEditable, validate } from "@/lib/domain/controls";
import { writeGuard } from "@/lib/api/write-guard";

/**
 * Create a reference-data record.
 *
 * NOT PROTECTED YET — `writeGuard` closes this in production and carries the
 * full explanation, plus the one place `verifySession()` goes when auth lands.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/controls/[collection]">,
) {
  const blocked = writeGuard();
  if (blocked) return blocked;

  const { collection } = await context.params;
  if (!isEditable(collection)) {
    return Response.json({ error: "Unknown collection." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const result = validate(collection, body);
  if (!result.ok || !result.data || !result.id) {
    return Response.json({ error: result.errors.join(" ") }, { status: 422 });
  }

  const db = adminDb();
  const ref = db.collection(collection).doc(result.id);

  // Create, not upsert. Silently overwriting an existing crop because someone
  // reused a name is a data-loss bug wearing a success toast.
  const existing = await ref.get();
  if (existing.exists) {
    return Response.json(
      { error: `${result.id} already exists. Edit it instead.` },
      { status: 409 },
    );
  }

  await ref.set({ ...result.data, createdAt: new Date() });

  return Response.json({ id: result.id, ...result.data }, { status: 201 });
}
