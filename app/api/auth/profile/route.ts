import { randomBytes } from "node:crypto";

import {
  accountFor,
  canSelfSignup,
  COLLECTION_FOR_SIGNUP,
  newAccountId,
  type SignupForm,
} from "@/lib/domain/signup";
import { isDistrictOf, stateById } from "@/lib/domain/india";
import {
  checkMobile,
  checkPincode,
  required,
  type FieldErrors,
} from "@/lib/domain/registration";
import { readPendingSession } from "@/lib/auth/session";
import { adminAuth, adminDb, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Turning a verified handset into an account.
 *
 * The second half of OTP registration. Phone auth proves somebody holds a
 * number; this is where they say who they are, and it is the only thing a
 * session without claims can reach.
 *
 * ## What it will not take from the request
 *
 * ## The mobile number, and how much it is worth
 *
 * An OTP sign-in arrives holding a *proven* handset, and that number is taken
 * from the token rather than the body — accepting a typed one there would let
 * somebody register against a number they do not hold.
 *
 * A Google sign-in proves an email and no handset at all. Refusing those would
 * mean the Google door only worked for people who had already signed in by SMS,
 * which is nobody. So a typed number is accepted when there is nothing better,
 * and `mobileVerified` records which of the two happened — operations can see
 * the difference, and a later step can ask for an OTP without guessing whether
 * one already happened.
 *
 * The **account id** is generated here, the **status** is always `pending`, and
 * the **role** is checked against `canSelfSignup` — so this endpoint cannot
 * mint operations, cannot attach itself to an existing account, and cannot
 * arrive pre-verified.
 *
 * ## Once, and only once
 *
 * A uid that already carries claims is refused. Without that, somebody could
 * post twice and leave two accounts pointing at one login, with the claims
 * naming whichever won.
 */

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

  const session = await readPendingSession();
  if (!session) {
    return Response.json(
      { error: "Verify your mobile number first.", code: "notVerified" },
      { status: 401 },
    );
  }

  const auth = adminAuth();
  const existing = await auth.getUser(session.uid);
  if (existing.customClaims?.role) {
    return Response.json(
      {
        error: "This login already has an account.",
        code: "alreadyRegistered",
      },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const role = text(body.role, 20);

  /*
    `+919843011204` from an OTP token, stored as ten digits like every other
    mobile here. Empty for a Google sign-in, which proves no handset.
  */
  const proven = session.phone
    ? session.phone.replace(/\D/g, "").slice(-10)
    : "";
  const typed = text(body.mobile, 20).replace(/\D/g, "").slice(-10);
  const values = {
    role,
    name: text(body.name),
    contactName: text(body.contactName) || text(body.name),
    email: text(body.email).toLowerCase(),
    password: "",
    // The proven number where there is one; otherwise whatever they typed,
    // recorded below as unverified.
    mobile: proven || typed,
    place: text(body.place),
    state: text(body.state, 60),
    district: text(body.district),
    pincode: text(body.pincode, 10),
  } satisfies SignupForm;

  /*
    The signup validators, minus the two that do not apply: there is no password
    on this path, and the email is optional because a farmer registering from a
    handset may not have one.
  */
  const errors: FieldErrors<SignupForm> = {
    role: canSelfSignup(role)
      ? undefined
      : "Choose the kind of account you need.",
    name: required(values.name, "Name"),
    // Only asked of somebody who has not already proven one.
    mobile: proven ? undefined : checkMobile(typed),
    place: required(values.place, "Village or town"),
    state: stateById(values.state) ? undefined : "Choose your state",
    district: !values.district
      ? "District is required"
      : isDistrictOf(values.state, values.district)
        ? undefined
        : "Pick a district in the state you chose",
    pincode: checkPincode(values.pincode),
  };

  const failed = Object.entries(errors).filter(([, message]) => message);
  if (failed.length > 0) {
    return Response.json(
      {
        error: "Check the highlighted fields.",
        fields: Object.fromEntries(failed),
      },
      { status: 422 },
    );
  }

  /*
    A photograph, if they took one. The path is checked against this uid's own
    folder for the same reason the roster endpoint checks its own: a path from a
    browser is otherwise a way to point a new account at somebody else's file.
  */
  const photo =
    body.photo && typeof body.photo === "object"
      ? (body.photo as Record<string, unknown>)
      : null;
  const photoPath = photo && typeof photo.path === "string" ? photo.path : "";
  if (photoPath && !photoPath.startsWith(`profiles/${session.uid}/`)) {
    return Response.json(
      {
        error: "That upload does not belong to this sign-in.",
        code: "foreignUpload",
      },
      { status: 403 },
    );
  }

  const db = adminDb();
  const collection =
    COLLECTION_FOR_SIGNUP[role as keyof typeof COLLECTION_FOR_SIGNUP];
  // Generated here, like the signup endpoint's, so an id can never arrive in
  // a request body and attach a new login to an existing account.
  const signupRole = role as Parameters<typeof newAccountId>[0];
  const accountId = newAccountId(signupRole, randomBytes(6).toString("hex"));
  const now = new Date();

  const record = {
    ...accountFor(signupRole, accountId, values, now),
    ...(photoPath ? { photoUrl: photoPath } : {}),
    // How they got here, so operations can tell a self-registration from an
    // account opened any other way, and by which door.
    registeredVia: proven ? ("mobileOtp" as const) : ("google" as const),
    /*
      Whether anybody has proved this handset. False for a Google sign-up, where
      the number was typed into a form — the platform should not later treat
      that as confirmation it never obtained.
    */
    mobileVerified: Boolean(proven),
    emailVerified: Boolean(session.emailVerified),
  };

  await db.collection(collection).doc(accountId).set(record);

  /*
    Claims last. Until they are set the session reaches nothing, so a failure
    between the write and here leaves an orphan account rather than a login
    holding a role with no record behind it — the safer way round, and one
    operations can see and clean up.
  */
  await auth.setCustomUserClaims(session.uid, { role, accountId });

  /*
    A custom token back, so the browser can pick up the claims it was just given.

    The session cookie in the browser was minted before the role existed and
    still says nothing. The obvious fix is to refresh the Firebase user's token
    — but this page is reached by a full document load, so there may be no
    Firebase user in memory at all. Minting a token here works either way: it is
    issued for the uid that already holds this session, so it grants nothing the
    caller does not already have, and it turns a fragile refresh into one that
    cannot fail for reasons of navigation.
  */
  const token = await auth.createCustomToken(session.uid, { role, accountId });

  return Response.json({ accountId, role, status: "pending", token }, { status: 201 });
}
