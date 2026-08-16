import { requireSession } from "@/lib/api/write-guard";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Marking notifications read.
 *
 * The only write a person makes to their own notifications, and it goes through
 * here rather than from the browser because clients never write to Firestore —
 * the rules ban it outright and this is not the place to make an exception.
 *
 * Not gated on a subscription. Reading what has happened to your own account is
 * not a paid capability, and a farmer whose plan has lapsed still needs to know
 * a buyer is waiting on them — that is half of why they would renew.
 */

/** How many a single call may touch. A batch caps at 500 operations. */
const LIMIT = 400;

export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const accountId = gate.session.claims.accountId;
  if (!accountId) {
    return Response.json(
      { error: "This account has no notifications.", code: "noAccount" },
      { status: 403 },
    );
  }

  let body: { ids?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const db = adminDb();
  const now = new Date();

  // The account is the path. Nothing below can reach another account's rows
  // even if an id from one is passed in — the lookup simply misses.
  const mine = db.collection("accounts").doc(accountId).collection("notifications");

  /*
    Ids arrive from the client and are looked up *under this account only*. In a
    flat collection that would need a read-then-compare on every id; here a
    borrowed id resolves to a document that does not exist, so it cannot even
    confirm somebody else's notification is real.
  */
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string").slice(0, LIMIT)
    : [];

  if (body.all === true) {
    // No `orderBy`, so this is a single-field query and needs no composite
    // index — which order they are cleared in does not matter.
    const unread = await mine.where("readAt", "==", null).limit(LIMIT).get();

    if (unread.empty) return Response.json({ marked: 0 });

    const batch = db.batch();
    for (const doc of unread.docs) batch.update(doc.ref, { readAt: now });
    await batch.commit();

    return Response.json({ marked: unread.size });
  }

  if (ids.length === 0) {
    return Response.json(
      { error: "Say which notifications, or pass all.", code: "nothingNamed" },
      { status: 422 },
    );
  }

  const docs = await db.getAll(...ids.map((id) => mine.doc(id)));
  const found = docs.filter((doc) => doc.exists);
  if (found.length === 0) return Response.json({ marked: 0 });

  const batch = db.batch();
  for (const doc of found) batch.update(doc.ref, { readAt: now });
  await batch.commit();

  return Response.json({ marked: found.length });
}
