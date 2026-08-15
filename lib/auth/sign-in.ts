"use client";

import {
  setPersistence,
  signInWithEmailAndPassword,
  inMemoryPersistence,
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
