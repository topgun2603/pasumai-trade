import { isRole } from "@/lib/auth/claims";
import { createSession, destroySession } from "@/lib/auth/session";

/**
 * Sign in and sign out.
 *
 * The only endpoint that accepts an ID token. The browser authenticates with
 * Firebase, gets a token, and posts it here exactly once; everything after that
 * is the session cookie.
 *
 * Deliberately says little on failure. "That sign-in could not be verified"
 * covers a forged token, an expired one and a token for another project alike —
 * distinguishing them would tell someone probing the endpoint which of their
 * guesses was closer.
 *
 * The one exception is a role mismatch, which says exactly what is wrong. It
 * is not a probe: whoever is asking has already authenticated successfully and
 * holds the credentials, so naming the console their own account belongs to
 * tells them nothing they could not read off their own dashboard — and not
 * naming it leaves them resetting a password that was never wrong.
 */
export async function POST(request: Request) {
  let body: { idToken?: unknown; as?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    return Response.json({ error: "No sign-in token." }, { status: 400 });
  }

  /*
    Which door this came through. Optional: the registration flow and the
    token-refresh path exchange a token with no door in mind, and gating those
    would refuse an account the claims it was issued a moment ago.
  */
  const expecting = isRole(body.as) ? body.as : undefined;

  const result = await createSession(idToken, expecting);
  if (!result.ok) {
    if ("mismatch" in result) {
      // 403, not 401: they are authenticated. What they are not is entitled to
      // this console, and the two statuses are read differently by anything in
      // front of this — a 401 invites a retry with different credentials.
      return Response.json(
        { error: result.error, code: "roleMismatch", role: result.role },
        { status: 403 },
      );
    }
    return Response.json({ error: result.error }, { status: 401 });
  }

  /*
    A verified handset with no account behind it is a success, not a failure.
    The caller sends them to create a profile; the cookie they now hold reaches
    nothing else, because every console guard requires claims.
  */
  if ("needsProfile" in result) return Response.json({ needsProfile: true });

  return Response.json({ role: result.role });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ signedOut: true });
}
