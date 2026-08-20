import { randomBytes } from "node:crypto";

import {
  accountFor,
  canSelfSignup,
  COLLECTION_FOR_SIGNUP,
  newAccountId,
  type SignupForm,
} from "@/lib/domain/signup";
import { isDistrictOf, stateById } from "@/lib/domain/india";
import { required, checkPincode, type FieldErrors } from "@/lib/domain/registration";
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
 * The **mobile number** comes from the verified session, never the body. It is
 * the one fact already proven, and accepting a typed one would let somebody
 * register an account against a number they do not hold.
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
  if (!session.phone) {
    return Response.json(
      { error: "This sign-in has no mobile number attached.", code: "noPhone" },
      { status: 403 },
    );
  }

  const auth = adminAuth();
  const existing = await auth.getUser(session.uid);
  if (existing.customClaims?.role) {
    return Response.json(
      { error: "This login already has an account.", code: "alreadyRegistered" },
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
  const values = {
    role,
    name: text(body.name),
    contactName: text(body.contactName) || text(body.name),
    email: text(body.email).toLowerCase(),
    password: "",
    // Proven, not typed. `+919843011204` from the token, stored as ten digits
    // like every other mobile on the platform.
    mobile: session.phone.replace(/\D/g, "").slice(-10),
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
    role: canSelfSignup(role) ? undefined : "Choose the kind of account you need.",
    name: required(values.name, "Name"),
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
      { error: "Check the highlighted fields.", fields: Object.fromEntries(failed) },
      { status: 422 },
    );
  }

  /*
    A photograph, if they took one. The path is checked against this uid's own
    folder for the same reason the roster endpoint checks its own: a path from a
    browser is otherwise a way to point a new account at somebody else's file.
  */
  const photo = body.photo && typeof body.photo === "object" ? (body.photo as Record<string, unknown>) : null;
  const photoPath = photo && typeof photo.path === "string" ? photo.path : "";
  if (photoPath && !photoPath.startsWith(`profiles/${session.uid}/`)) {
    return Response.json(
      { error: "That upload does not belong to this sign-in.", code: "foreignUpload" },
      { status: 403 },
    );
  }

  const db = adminDb();
  const collection = COLLECTION_FOR_SIGNUP[role as keyof typeof COLLECTION_FOR_SIGNUP];
  // Generated here, like the signup endpoint's, so an id can never arrive in
  // a request body and attach a new login to an existing account.
  const signupRole = role as Parameters<typeof newAccountId>[0];
  const accountId = newAccountId(signupRole, randomBytes(6).toString("hex"));
  const now = new Date();

  const record = {
    ...accountFor(signupRole, accountId, values, now),
    ...(photoPath ? { photoUrl: photoPath } : {}),
    // How they got here, so operations can tell a self-registration from an
    // account opened any other way.
    registeredVia: "mobileOtp" as const,
  };

  await db.collection(collection).doc(accountId).set(record);

  /*
    Claims last. Until they are set the session reaches nothing, so a failure
    between the write and here leaves an orphan account rather than a login
    holding a role with no record behind it — the safer way round, and one
    operations can see and clean up.
  */
  await auth.setCustomUserClaims(session.uid, { role, accountId });

  return Response.json({ accountId, role, status: "pending" }, { status: 201 });
}
