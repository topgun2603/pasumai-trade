import "server-only";

import { cookies } from "next/headers";

import { adminAuth, hasAdminCredentials } from "@/lib/firebase/admin";

import { readClaims, type Claims, type Role } from "./claims";

/**
 * Server-side sessions.
 *
 * Firebase hands the *browser* an ID token, which is useless to a server
 * component and to a route handler — neither can read something held in
 * JavaScript memory on the client. So the token is exchanged once, at sign-in,
 * for a session cookie that the server can verify on every request.
 *
 * The cookie is `httpOnly`, so no script can read it; `secure` outside
 * development; and `sameSite: lax`, which still arrives on a top-level
 * navigation — a link into the console from an email has to work — while not
 * riding along on a cross-site POST.
 *
 * Verification is `checkRevoked`, which costs a lookup but means a disabled or
 * signed-out user stops working immediately rather than at the end of the
 * cookie's life. For a console that can move money, that trade is worth paying
 * on every request.
 */

export const SESSION_COOKIE = "pasumai_session";

/**
 * Five days. Long enough that operations are not signing in every morning,
 * short enough that a laptop left in a truck stops being a key that week.
 * Firebase caps session cookies at 14 days.
 */
const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export interface Session {
  readonly uid: string;
  readonly email?: string;
  readonly claims: Claims;
}

/**
 * Exchanges a freshly minted ID token for a session cookie.
 *
 * Rejects a token issued more than five minutes ago. The client gets one
 * immediately after signing in and posts it straight here, so anything older
 * is a replay of a captured token rather than a real sign-in.
 */
export async function createSession(idToken: string): Promise<
  { ok: true; role: Role } | { ok: false; error: string }
> {
  if (!hasAdminCredentials()) {
    return {
      ok: false,
      error:
        "Sign-in is unavailable: this deployment has no Firebase Admin credentials.",
    };
  }

  const auth = adminAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return { ok: false, error: "That sign-in could not be verified." };
  }

  const ageMs = Date.now() - decoded.auth_time * 1000;
  if (ageMs > 5 * 60 * 1000) {
    return { ok: false, error: "That sign-in has gone stale. Try again." };
  }

  const claims = readClaims(decoded as unknown as Record<string, unknown>);
  if (!claims) {
    // The account exists in Firebase Auth but operations has not given it a
    // role. Said plainly, because the person cannot fix it themselves.
    return {
      ok: false,
      error:
        "This account is not set up for the platform yet. Ask operations to finish activating it.",
    };
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return { ok: true, role: claims.role };
}

/**
 * Who is asking, or `null`.
 *
 * Every guard in the application funnels through here. It never throws: a
 * malformed, expired or revoked cookie is simply nobody, and callers refuse on
 * `null`. Failing closed is the whole point — an error escaping this function
 * would have to be caught at each call site, and one missed catch would be an
 * unguarded endpoint.
 */
export async function verifySession(): Promise<Session | null> {
  if (!hasAdminCredentials()) return null;

  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    const claims = readClaims(decoded as unknown as Record<string, unknown>);
    if (!claims) return null;

    return { uid: decoded.uid, email: decoded.email, claims };
  } catch {
    return null;
  }
}

/** Signs out here and everywhere — revokes the refresh tokens too. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;

  store.delete(SESSION_COOKIE);

  if (!cookie || !hasAdminCredentials()) return;

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, false);
    // Without this, an already-issued session cookie on another device stays
    // valid for the rest of its five days. "Sign out" has to mean it.
    await adminAuth().revokeRefreshTokens(decoded.sub);
  } catch {
    // Already invalid. Clearing the cookie was the part that mattered.
  }
}
