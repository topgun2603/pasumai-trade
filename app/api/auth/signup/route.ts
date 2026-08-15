import { randomBytes } from "node:crypto";

import {
  accountFor,
  canSelfSignup,
  COLLECTION_FOR_SIGNUP,
  newAccountId,
  validateSignup,
  type SignupForm,
} from "@/lib/domain/signup";
import { toE164 } from "@/lib/domain/registration";
import { adminAuth, adminDb, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Create an account.
 *
 * The only unauthenticated write endpoint on the platform, which is why it is
 * written more defensively than the rest. Three things it will not do:
 *
 *   - mint operations. `canSelfSignup` excludes `admin`, and the check is here
 *     rather than only in the form, because the form is not what posts to this.
 *   - accept an account id. Ids are generated server-side; taking one from the
 *     body would let a signup attach itself to an existing verified buyer and
 *     inherit their orders.
 *   - accept a status. Every account created here is `pending`, which the order
 *     guards already refuse to transact with. Signing up gets you a login and a
 *     place in the verification queue, not the ability to trade.
 *
 * What it deliberately lacks is rate limiting. There is no shared store to hold
 * a counter — an in-memory one on serverless resets per instance and would read
 * as protection without being any. The real fix is Firebase App Check or a rate
 * limit at the edge, and until one of those is configured this endpoint can be
 * used to create junk accounts. They land unverified and inert, so the cost is
 * queue noise for operations rather than exposure, but it is a real gap and not
 * one to discover later.
 */

/** Strings only, trimmed, with a length ceiling so a body cannot be a novel. */
function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return Response.json(
      { error: "Registration is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const values: SignupForm = {
    role: text(body.role, 20),
    name: text(body.name),
    contactName: text(body.contactName),
    email: text(body.email).toLowerCase(),
    // Not trimmed to a shorter ceiling and not normalised: a passphrase is
    // whatever they typed, and silently altering it means it will not match at
    // sign-in.
    password: typeof body.password === "string" ? body.password : "",
    mobile: text(body.mobile, 20),
    place: text(body.place),
    district: text(body.district),
    pincode: text(body.pincode, 10),
  };

  // The same function the form runs, so a field cannot be valid in the browser
  // and invalid here or the other way round.
  const errors = validateSignup(values);
  const failed = Object.entries(errors).filter(([, message]) => message);
  if (failed.length > 0) {
    return Response.json(
      { error: "Check the highlighted fields.", fields: Object.fromEntries(failed) },
      { status: 422 },
    );
  }

  // Narrowed by validateSignup, repeated for the type and because this is the
  // line that keeps `admin` out.
  if (!canSelfSignup(values.role)) {
    return Response.json({ error: "That account type cannot be created here." }, { status: 422 });
  }
  const role = values.role;

  const auth = adminAuth();
  const db = adminDb();
  const now = new Date();
  const accountId = newAccountId(role, randomBytes(8).toString("hex"));

  // The account document first. If creating the user fails after this, an
  // orphan pending record is visible to operations and can be cleared; the
  // reverse — a login with no account — is a user who can sign in and reach a
  // console with claims pointing at nothing.
  await db.collection(COLLECTION_FOR_SIGNUP[role]).doc(accountId).set(
    accountFor(role, accountId, values, now),
  );

  let uid: string;
  try {
    const user = await auth.createUser({
      email: values.email,
      password: values.password,
      displayName: values.contactName || values.name,
      // The number goes on the *same* user record as the email, which is what
      // makes OTP sign-in work at all. Firebase matches an SMS sign-in to an
      // existing user by phone number, so the session it produces carries the
      // role and accountId claims already set below. Without this, signing in
      // by OTP would mint a second, claimless user and be refused.
      ...(toE164(values.mobile) ? { phoneNumber: toE164(values.mobile)! } : {}),
    });
    uid = user.uid;
  } catch (error) {
    // Roll the account back so a retry does not leave a trail of half-made
    // records behind it.
    await db.collection(COLLECTION_FOR_SIGNUP[role]).doc(accountId).delete();

    const code = (error as { code?: string }).code ?? "";
    if (code === "auth/email-already-exists") {
      return Response.json(
        {
          error: "An account already uses that email. Sign in instead, or use another address.",
          fields: { email: "Already registered" },
        },
        { status: 409 },
      );
    }
    if (code === "auth/phone-number-already-exists") {
      return Response.json(
        {
          error:
            "An account already uses that mobile number. Sign in with it, or register with another.",
          fields: { mobile: "Already registered" },
        },
        { status: 409 },
      );
    }
    if (code === "auth/invalid-password") {
      return Response.json(
        { error: "Choose a longer password.", fields: { password: "Too weak" } },
        { status: 422 },
      );
    }
    throw error;
  }

  // Claims last, and only after both records exist. A user carrying a role for
  // an account that was never written is exactly the state the ordering above
  // is there to prevent.
  await auth.setCustomUserClaims(uid, { role, accountId });

  return Response.json({ accountId, role, status: "pending" }, { status: 201 });
}
