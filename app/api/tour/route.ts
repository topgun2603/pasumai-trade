import { requireSession } from "@/lib/api/write-guard";
import { adminDb } from "@/lib/firebase/admin";
import { TOURS } from "@/lib/domain/tour";

/**
 * Recording that somebody has been shown their console tour.
 *
 * Through a route rather than from the browser, like every other write here —
 * clients do not touch Firestore and this is not the exception worth making for
 * a flag.
 *
 * Not gated on a subscription or on verification. This is the write that stops
 * a tour reappearing, and somebody whose documents are still being checked is
 * exactly the person seeing it.
 */
export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const accountId = gate.session.claims.accountId;
  if (!accountId) {
    return Response.json(
      { error: "This session has no account.", code: "noAccount" },
      { status: 403 },
    );
  }

  let body: { tour?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  /*
    Checked against the known tours rather than stored as sent. The value
    becomes a field name on a document that lives forever, so an unbounded
    string from a browser would let anybody grow the account document a key at
    a time.
  */
  const tour = typeof body.tour === "string" ? body.tour : "";
  const known = Object.values(TOURS).some((entry) => entry?.id === tour);
  if (!known) {
    return Response.json(
      { error: "No such tour.", code: "unknownTour" },
      { status: 422 },
    );
  }

  // Merged, because this document also carries notifications and push tokens
  // beneath it and may not exist yet for an account that has never had either.
  await adminDb()
    .collection("accounts")
    .doc(accountId)
    .set({ toursSeen: { [tour]: new Date() } }, { merge: true });

  return Response.json({ seen: tour });
}
