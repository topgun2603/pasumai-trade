"use client";

import {
  RecaptchaVerifier,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
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
      // Almost always an unauthorised domain: reCAPTCHA refuses to run on a
      // host that is not in the Firebase authorised-domains list, and the SDK
      // reports it as a captcha failure rather than as a configuration one.
      return "Could not verify this device. This site may not be authorised for SMS sign-in yet.";
    default:
      return "Could not sign in. Try again.";
  }
}

export async function signIn(
  email: string,
  password: string,
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

  return exchange(idToken);
}

/** The half both sign-in paths share: token in, session cookie out. */
async function exchange(idToken: string): Promise<SignInResult> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((d: { error?: string }) => d.error)
      .catch(() => null);
    return { ok: false, error: detail ?? "Could not start a session." };
  }

  const { role } = (await response.json()) as { role: string };
  return { ok: true, role };
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
    const confirmer = await signInWithPhoneNumber(auth, e164, recaptcha(containerId));
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

  return exchange(idToken);
}
