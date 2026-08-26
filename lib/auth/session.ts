import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";

import { adminAuth, hasAdminCredentials } from "@/lib/firebase/admin";

import { readClaims, ROLE_LABELS, type Claims, type Role } from "./claims";

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
export type SessionStart =
  | { ok: true; role: Role }
  /**
   * A verified sign-in with nobody behind it yet.
   *
   * Phone auth creates the Firebase user the moment the code is right, so a
   * number nobody has registered arrives here holding a genuine token and no
   * role. That used to be refused with "ask operations to finish activating
   * it", which is a dead end for the one person the platform most wants — a
   * new farmer who has just proved they own the handset.
   *
   * A cookie is still minted, deliberately. It grants nothing: `verifySession`
   * requires claims and every console guard goes through it, so the only thing
   * this session can reach is the profile endpoint that turns it into a real
   * account.
   */
  | { ok: true; needsProfile: true }
  /**
   * The credentials are good; they are not this door's credentials.
   *
   * Kept apart from a plain failure because it is not one — the person typed
   * the right password, and telling them "that email and password do not
   * match" would send them round a loop resetting a password that was never
   * wrong. `role` is the account's actual role, so the caller can name the
   * door they should have used.
   *
   * **No cookie is minted on this branch.** That is the whole point: refusing
   * to route somebody while leaving them holding a valid session would be a
   * message rather than a check, and the next URL they typed would work.
   */
  | { ok: false; mismatch: true; role: Role; error: string }
  | { ok: false; error: string };

export async function createSession(
  idToken: string,
  /**
   * The door this sign-in came through, if it came through one.
   *
   * The sign-in page has a tab per console, and it was decoration: whatever
   * you picked, the account's own role decided where you landed, so farmer
   * credentials typed on the Buyer tab signed you in and dropped you on the
   * farm console. Nothing was escalated — you got your own console either way
   * — but the platform quietly overruled a choice somebody had just made, and
   * role-mismatch testing across five consoles could not be trusted.
   *
   * Checked here rather than in the route handler or the form, because this is
   * the only place a cookie is created. A check anywhere upstream is a check
   * that can be skipped by posting the token directly.
   */
  expecting?: Role,
): Promise<SessionStart> {
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
    // Verified, but no role yet — they have proved the handset and not yet said
    // who they are. See `SessionStart` for why this still gets a cookie.
    await mint(auth, idToken);
    return { ok: true, needsProfile: true };
  }

  if (expecting && claims.role !== expecting) {
    return {
      ok: false,
      mismatch: true,
      role: claims.role,
      error: `This account is registered as ${article(claims.role)}. Sign in through the ${ROLE_LABELS[claims.role]} console.`,
    };
  }

  await mint(auth, idToken);
  return { ok: true, role: claims.role };
}

/** "a farmer", "an admin" — so the sentence above reads. */
function article(role: Role): string {
  const label = ROLE_LABELS[role].toLowerCase();
  return `${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`;
}

/** The cookie itself. One definition, so the pending and full paths agree. */
async function mint(
  auth: ReturnType<typeof adminAuth>,
  idToken: string,
): Promise<void> {
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
}

/**
 * Who is holding a cookie, whether or not they have a role.
 *
 * `verifySession` returns null without claims, which is what every console
 * guard needs. This is the one thing that must see the other case: somebody who
 * has verified a handset and is on their way to creating a profile. It returns
 * the identity and nothing else — no role, no accountId — so it cannot be
 * mistaken for authorisation.
 */
export async function readPendingSession(): Promise<{
  uid: string;
  phone?: string;
  email?: string;
  /** Google proves this on the way in; a password account does not, until the
      person clicks the link the browser asked Firebase to send. */
  emailVerified: boolean;
} | null> {
  if (!hasAdminCredentials()) return null;

  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: decoded.uid,
      phone: decoded.phone_number as string | undefined,
      email: decoded.email,
      // Google proves the address itself; a password sign-up does not until
      // somebody clicks the link Firebase sent them.
      emailVerified: decoded.email_verified === true,
    };
  } catch {
    return null;
  }
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
/*
  Verified once per request.

  `verifySessionCookie(cookie, true)` asks Firebase whether the session has been
  revoked, which is a network call — and this runs from `requireConsole`, from
  `requireAgency` inside it, and again from every page under a layout that
  already did it. Three or four revocation checks for one page view, all with
  the same answer.

  `cache` is per request, so revocation is still checked on every page view. It
  is checked once instead of once per caller.
*/
export const verifySession = cache(
  async function verifySession(): Promise<Session | null> {
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
  },
);

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
