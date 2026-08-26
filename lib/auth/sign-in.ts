"use client";

import {
  GoogleAuthProvider,
  signInWithCustomToken,
  RecaptchaVerifier,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  inMemoryPersistence,
  type ConfirmationResult,
} from "firebase/auth";

import { auth as firebaseAuth } from "@/lib/firebase/client";

/**
 * Signing in, from the browser.
 *
 * Two steps, and the second is the one that matters: Firebase authenticates
 * and hands back an ID token, then that token is posted to `/api/auth/session`
 * exactly once and exchanged for an httpOnly session cookie. Everything after
 * that is the cookie — server components and route handlers cannot read a
 * token held in client memory.
 *
 * Persistence is `inMemory` on purpose. The usual Firebase behaviour keeps a
 * refresh token in IndexedDB so the browser stays signed in on its own, which
 * would leave two competing notions of "signed in": the SDK's and the server's.
 * The session cookie is the one the platform actually enforces, so the client
 * SDK is deliberately forgetful and the cookie is the single source of truth.
 */

export interface SignInResult {
  readonly ok: boolean;
  readonly role?: string;
  readonly error?: string;
  /** Verified, but nobody has said who they are yet. Send them to register. */
  readonly needsProfile?: boolean;
  /**
   * Right credentials, wrong door.
   *
   * Distinguished from an ordinary failure so the form can offer the console
   * the account *does* belong to rather than only saying no. `role` is what
   * the account actually is.
   */
  readonly mismatch?: boolean;
}

/** Firebase error codes, said in a way that helps without helping an attacker. */
function readable(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      // One message for all three: distinguishing them tells someone probing
      // which addresses are real accounts.
      return "That email and password do not match.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact operations.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Could not reach the server. Check your connection.";
    case "auth/operation-not-allowed":
      // The provider is switched off in the Firebase console. Said plainly
      // because nobody signing in can fix it, and the alternative is a generic
      // failure that looks like their fault.
      return "That way of signing in is not switched on for this project yet.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google window closed before sign-in finished.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups and try again.";
    case "auth/account-exists-with-different-credential":
      return "That email already has an account here. Sign in with your password instead.";
    case "auth/invalid-api-key":
    case "auth/configuration-not-found":
      return "Sign-in is not configured on this deployment.";
    case "auth/invalid-phone-number":
      return "That is not a valid mobile number.";
    case "auth/invalid-verification-code":
      return "That code is not right. Check it and try again.";
    case "auth/code-expired":
      return "That code has expired. Ask for a new one.";
    case "auth/quota-exceeded":
      return "Too many codes sent today. Sign in with your email and password instead.";
    case "auth/captcha-check-failed":
    case "auth/missing-app-credential":
    case "auth/invalid-app-credential":
      /*
       * Two different configuration faults arrive here wearing the same code,
       * and neither is anything the person typing can fix:
       *
       *  - the host is not in Firebase's authorised-domains list, so reCAPTCHA
       *    refuses to run at all;
       *  - the project's SMS region policy does not allow the destination.
       *    New projects default to allowlist-only with an *empty* list, which
       *    blocks every country including India, and the REST call comes back
       *    a bare 400.
       *
       * Both are said plainly rather than as "try again", which would send
       * somebody round the same loop for an hour.
       */
      return "SMS sign-in is not configured for this site yet. Use your email and password, and tell operations.";
    case "auth/unsupported-region":
      return "SMS sign-in is not available for that number's country.";
    default:
      return "Could not sign in. Try again.";
  }
}

export async function signIn(
  email: string,
  password: string,
  /** The console tab that was chosen. See `exchange`. */
  expecting?: string,
): Promise<SignInResult> {
  let idToken: string;

  try {
    const auth = firebaseAuth();
    await setPersistence(auth, inMemoryPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    idToken = await credential.user.getIdToken();
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    return { ok: false, error: readable(code) };
  }

  return exchange(idToken, expecting);
}

/**
 * The half every sign-in path shares: token in, session cookie out.
 *
 * `expecting` is the console tab that was chosen, and the server refuses to
 * mint a cookie when the account's role is a different one. It is passed
 * rather than checked here on purpose: a check in the browser is a check
 * anybody can post around.
 *
 * On a mismatch the Firebase client is signed out as well. The server never
 * issued a cookie, but the SDK is still holding an authenticated user, and
 * leaving it there means the next thing to call `getIdToken` quietly succeeds
 * as somebody who was just refused.
 */
async function exchange(
  idToken: string,
  expecting?: string,
): Promise<SignInResult> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, as: expecting }),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
      role?: string;
    } | null;

    if (detail?.code === "roleMismatch") {
      await firebaseSignOut(firebaseAuth()).catch(() => {
        // Already gone, or the SDK never held one. The cookie is what the
        // platform enforces and none was issued, so this is tidying.
      });
      return { ok: false, mismatch: true, role: detail.role, error: detail.error };
    }

    return { ok: false, error: detail?.error ?? "Could not start a session." };
  }

  const body = (await response.json()) as {
    role?: string;
    needsProfile?: boolean;
  };
  if (body.needsProfile) return { ok: true, needsProfile: true };
  return { ok: true, role: body.role };
}

/**
 * Swap a stale session for one that knows the new claims.
 *
 * Registration sets `role` and `accountId` on the Firebase user *after* the
 * cookie was minted, so the cookie in the browser still says nothing. Forcing a
 * token refresh picks the claims up and exchanges again; without it the console
 * would turn the new account straight back around.
 *
 * Returns `ok: false` rather than throwing when there is no signed-in user,
 * which happens if the page was reloaded — persistence here is in memory by
 * design. The caller sends them to sign in, which now works, because by this
 * point the account exists.
 */
export async function refreshSession(): Promise<SignInResult> {
  const user = firebaseAuth().currentUser;
  if (!user) return { ok: false, error: "Sign in again to finish." };

  try {
    // `true` forces a round trip to Firebase; without it the cached token comes
    // back with exactly the claims it had before.
    const idToken = await user.getIdToken(true);
    return exchange(idToken);
  } catch {
    return { ok: false, error: "Sign in again to finish." };
  }
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
}

/* -------------------------------------------------------------------------
   One-time password, by SMS
   ------------------------------------------------------------------------- */

/**
 * OTP sign-in, in two calls.
 *
 * `startPhoneSignIn` sends the code and returns a confirmer; `confirmPhoneCode`
 * takes what the person typed and finishes the same session exchange the email
 * path uses. The route handler does not know or care which of the two produced
 * the token.
 *
 * This works because signup puts the mobile number on the *same* Firebase user
 * as the email. Firebase matches an SMS sign-in to an existing user by phone
 * number, so the resulting token already carries the role and accountId claims.
 * A number that belongs to no account produces a user with no claims, and
 * `createSession` refuses it — which is the correct answer, not a bug.
 *
 * reCAPTCHA is mandatory: Firebase will not send an SMS without proving the
 * request came from a browser on an authorised domain. The invisible variant
 * runs without anything to click in the ordinary case, and falls back to a
 * challenge when Google is suspicious of the device.
 */

export interface PhoneStart {
  readonly ok: boolean;
  readonly confirmer?: ConfirmationResult;
  readonly error?: string;
}

let verifier: RecaptchaVerifier | undefined;

/**
 * One verifier per page, reused.
 *
 * A second `RecaptchaVerifier` on the same container throws, and creating one
 * per attempt is exactly what happens when somebody mistypes their number and
 * presses send again.
 */
function recaptcha(containerId: string): RecaptchaVerifier {
  if (verifier) return verifier;
  verifier = new RecaptchaVerifier(firebaseAuth(), containerId, {
    size: "invisible",
  });
  return verifier;
}

/** Throw the verifier away so the next attempt starts clean. */
export function resetPhoneVerifier(): void {
  try {
    verifier?.clear();
  } catch {
    // Already gone, or the container was unmounted first. Nothing to do — the
    // point is only to stop reusing a dead one.
  }
  verifier = undefined;
}

export async function startPhoneSignIn(
  e164: string,
  containerId: string,
): Promise<PhoneStart> {
  try {
    const auth = firebaseAuth();
    await setPersistence(auth, inMemoryPersistence);
    const confirmer = await signInWithPhoneNumber(
      auth,
      e164,
      recaptcha(containerId),
    );
    return { ok: true, confirmer };
  } catch (error) {
    // The verifier is single-use once a send has been attempted; keeping it
    // would make every retry fail for a reason unrelated to the real one.
    resetPhoneVerifier();
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    return { ok: false, error: readable(code) };
  }
}

export async function confirmPhoneCode(
  confirmer: ConfirmationResult,
  code: string,
  /** The console tab that was chosen. See `exchange`. */
  expecting?: string,
): Promise<SignInResult> {
  let idToken: string;

  try {
    const credential = await confirmer.confirm(code);
    idToken = await credential.user.getIdToken();
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    return { ok: false, error: readable(errorCode) };
  }

  return exchange(idToken, expecting);
}

/* -------------------------------------------------------------------------
   Google
   ------------------------------------------------------------------------- */

/**
 * Sign in with a Google account.
 *
 * A popup rather than a redirect. A redirect loses the page, and this form
 * holds a chosen door and a half-typed identifier that would be gone on the way
 * back; the popup also keeps the in-memory Firebase user alive, which the
 * registration step downstream depends on.
 *
 * Google proves an *email*, not a handset. A new account arriving this way has
 * no phone number, so the profile step asks for one — see the note in
 * `app/api/auth/profile/route.ts` about the difference between a number that
 * was proven and one that was typed.
 */
export async function signInWithGoogle(
  /** The console tab that was chosen. See `exchange`. */
  expecting?: string,
): Promise<SignInResult> {
  let idToken: string;

  try {
    const auth = firebaseAuth();
    await setPersistence(auth, inMemoryPersistence);

    const provider = new GoogleAuthProvider();
    // Always ask which account. Without this, somebody already signed into one
    // Google account in that browser is silently signed in as them — on a
    // shared handset that is the wrong person's produce.
    provider.setCustomParameters({ prompt: "select_account" });

    const credential = await signInWithPopup(auth, provider);
    idToken = await credential.user.getIdToken();
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    return { ok: false, error: readable(code) };
  }

  return exchange(idToken, expecting);
}

/* -------------------------------------------------------------------------
   Proving an email address
   ------------------------------------------------------------------------- */

/**
 * Send the verification email Firebase writes and delivers itself.
 *
 * No provider to configure and nothing billed per message: this is the one
 * email the platform can send today. The address is proven by the person
 * clicking the link, and `emailVerified` on the Firebase user is what records
 * it — the platform does not keep its own copy to drift.
 *
 * Requires a signed-in client, which is why registration signs in immediately
 * after creating the account rather than sending the person to the sign-in
 * page: the Admin SDK can *generate* a link but cannot deliver one.
 */
export async function sendVerificationEmail(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const user = firebaseAuth().currentUser;
  if (!user) return { ok: false, error: "Sign in first." };
  if (user.emailVerified) return { ok: true };

  try {
    await sendEmailVerification(user);
    return { ok: true };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    // `auth/too-many-requests` is the common one, and it means the email is
    // already on its way rather than that anything is broken.
    return { ok: false, error: readable(code) };
  }
}

/**
 * Adopt the claims the profile step just set, from a token it minted.
 *
 * `refreshSession` needs a Firebase user already in memory, and the profile
 * page is reached by a full document load — crossing from the public site to
 * the console crosses root layouts, so there may be none. A custom token needs
 * no prior user: signing in with it produces an ID token carrying the new role
 * and account id, which the session route exchanges for a cookie that finally
 * says who they are.
 */
export async function adoptToken(customToken: string): Promise<SignInResult> {
  try {
    const auth = firebaseAuth();
    await setPersistence(auth, inMemoryPersistence);
    const credential = await signInWithCustomToken(auth, customToken);
    return exchange(await credential.user.getIdToken());
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    return { ok: false, error: readable(code) };
  }
}
