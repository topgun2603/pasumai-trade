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
 */
export async function POST(request: Request) {
  let body: { idToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) {
    return Response.json({ error: "No sign-in token." }, { status: 400 });
  }

  const result = await createSession(idToken);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 401 });
  }

  return Response.json({ role: result.role });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ signedOut: true });
}
