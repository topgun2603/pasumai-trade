import { adminDb } from "@/lib/firebase/admin";
import { isEditable, validate } from "@/lib/domain/controls";

/**
 * Create a reference-data record.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  NOT PROTECTED YET. Gated to development because of it.
 *
 *  Security Rules deny every client write, so mutations have to come through
 *  a route handler holding Admin credentials — and the Admin SDK bypasses
 *  rules entirely. Until Firebase Auth and session cookies are wired up there
 *  is no way for this handler to know who is calling, and an unauthenticated
 *  endpoint that writes with Admin credentials is a hole, not a feature.
 *
 *  When auth lands, replace the guard below with:
 *      const session = await verifySession();
 *      if (session.role !== "admin") return forbidden();
 *  and delete the production check.
 * ─────────────────────────────────────────────────────────────────────────
 */
function guard(): Response | null {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  return null;
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/controls/[collection]">,
) {
  const blocked = guard();
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
