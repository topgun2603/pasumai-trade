import { requireSession } from "@/lib/api/write-guard";
import { tokenId } from "@/lib/domain/push";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Registering and forgetting a device for push.
 *
 * The token comes from the browser — it is issued by Firebase Messaging to that
 * specific browser — but which account it belongs to comes from the session,
 * never from the body. Otherwise anybody could register their own device
 * against somebody else's account and receive that person's trade
 * notifications, which is about as direct a leak as this platform has.
 *
 * Not gated on a subscription. Being told what has happened to your own account
 * is not a paid capability.
 */

/** A registration nobody has used in this long is presumed gone. */
const MAX_LABEL = 80;

function tokens(accountId: string) {
  return adminDb().collection("accounts").doc(accountId).collection("pushTokens");
}

export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const accountId = gate.session.claims.accountId;
  if (!accountId) {
    return Response.json(
      { error: "This account cannot receive notifications.", code: "noAccount" },
      { status: 403 },
    );
  }

  let body: { token?: unknown; label?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  // An FCM token is a long opaque string. Length is the only shape worth
  // checking — anything else is guessing at a format Google may change.
  if (token.length < 20 || token.length > 4096) {
    return Response.json({ error: "That is not a device token." }, { status: 422 });
  }

  const label =
    typeof body.label === "string" ? body.label.trim().slice(0, MAX_LABEL) : "";

  const now = new Date();

  // Keyed on the token, so a browser re-registering the same one updates its
  // row rather than adding a second. `set` with merge, not `create`: this is
  // the one place a repeat is not a duplicate but a heartbeat.
  await tokens(accountId)
    .doc(tokenId(token))
    .set(
      {
        token,
        accountId,
        label: label || null,
        lastSeenAt: now,
        createdAt: now,
      },
      { merge: true },
    );

  return Response.json({ registered: true });
}

/** Turning push off on this device. */
export async function DELETE(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const accountId = gate.session.claims.accountId;
  if (!accountId) return Response.json({ error: "No account." }, { status: 403 });

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return Response.json({ error: "Which device?" }, { status: 422 });

  // Under this account's path, so a token borrowed from somewhere else simply
  // does not resolve — there is nothing to delete and nothing to learn.
  await tokens(accountId).doc(tokenId(token)).delete();

  return Response.json({ registered: false });
}
