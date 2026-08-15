
import {
  checkEmail,
  checkMobile,
  checkPincode,
  required,
  type FieldErrors,
} from "./registration";

/**
 * Self-signup.
 *
 * Anyone may create an account except operations. What signing up does *not*
 * do is grant access to anything: the account lands `pending`, which every
 * guard on the platform already treats as "cannot transact". Verification is
 * still a person at the platform checking documents — signup only removes the
 * step where that person also had to do the typing.
 *
 * Operations is excluded and the exclusion is enforced on the server. An
 * endpoint that mints an admin because the request asked for one is not a
 * signup form, it is a privilege escalation.
 */
export const SELF_SIGNUP_ROLES = [
  "franchise",
  "buyer",
  "transport",
  "manpower",
  "farmer",
] as const;

export type SignupRole = (typeof SELF_SIGNUP_ROLES)[number];

export function canSelfSignup(role: string): role is SignupRole {
  return (SELF_SIGNUP_ROLES as readonly string[]).includes(role);
}

/** Which collection a new account of this role is written to. */
export const COLLECTION_FOR_SIGNUP: Record<SignupRole, string> = {
  franchise: "buyers",
  buyer: "buyers",
  transport: "agencies",
  manpower: "agencies",
  farmer: "farmers",
};

/** Id prefix, matching the convention the seeded records already use. */
const PREFIX: Record<SignupRole, string> = {
  franchise: "B",
  buyer: "B",
  transport: "AG",
  manpower: "AG",
  farmer: "F",
};

/**
 * A readable id with a random tail.
 *
 * Random rather than sequential because a counter needs a read-modify-write on
 * every signup, and two people registering in the same second is exactly when
 * that goes wrong. Six base-36 characters is roughly two billion values, which
 * is far past the point where a collision matters for a platform onboarding
 * accounts by hand afterwards.
 */
export function newAccountId(role: SignupRole, random: string): string {
  return `${PREFIX[role]}-${random.slice(0, 6).toUpperCase()}`;
}

export interface SignupForm {
  role: string;
  /** Business name, or the person's name for a farmer. */
  name: string;
  contactName: string;
  email: string;
  password: string;
  mobile: string;
  /** Village for a farmer, town otherwise. */
  place: string;
  district: string;
  pincode: string;
}

/**
 * Twelve characters, and nothing else.
 *
 * No composition rules: forcing a symbol and a digit reliably produces
 * `Password1!` and a sticky note. Length is the property that actually resists
 * guessing, and it is the one a person can satisfy with three words they will
 * remember.
 */
const MIN_PASSWORD = 12;

export function checkPassword(value: string): string | undefined {
  if (value === "") return "Password is required";
  if (value.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters — three words you will remember beats a short one with symbols in it`;
  }
  return undefined;
}

export function validateSignup(values: SignupForm): FieldErrors<SignupForm> {
  return {
    role: canSelfSignup(values.role)
      ? undefined
      : "Choose the kind of account you need.",
    name: required(values.name, "Name"),
    contactName: required(values.contactName, "Contact name"),
    email: checkEmail(values.email),
    password: checkPassword(values.password),
    mobile: checkMobile(values.mobile),
    place: required(values.place, "Village or town"),
    district: required(values.district, "District"),
    pincode: checkPincode(values.pincode),
  };
}

/**
 * The account document a signup creates.
 *
 * Every field the platform decides for itself — status, counters, documents —
 * is set here rather than taken from the request. A signup that could post its
 * own `status: "verified"` would make verification decorative.
 */
export function accountFor(
  role: SignupRole,
  id: string,
  values: SignupForm,
  now: Date,
): Record<string, unknown> {
  const base = {
    status: "pending" as const,
    registeredAt: now,
    documents: [],
  };

  if (role === "farmer") {
    return {
      ...base,
      name: values.name,
      mobile: values.mobile,
      village: values.place,
      district: values.district,
      bankAccountTail: "",
      registeredBy: "self",
      activeListings: 0,
      completedOrders: 0,
      photoUrl: null,
      landPhotoUrl: null,
    };
  }

  if (role === "transport" || role === "manpower") {
    return {
      ...base,
      name: values.name,
      // What they signed up as, and nothing more. A firm wanting both
      // contracts asks operations for the second one.
      services: [role === "transport" ? "transport" : "manpower"],
      contactName: values.contactName,
      mobile: values.mobile,
      email: values.email,
      district: values.district,
      town: values.place,
      districts: [values.district],
      photoUrl: null,
    };
  }

  return {
    ...base,
    name: values.name,
    kind: role === "franchise" ? "franchise" : "independent",
    contactName: values.contactName,
    mobile: values.mobile,
    town: values.place,
    district: values.district,
    districts: [values.district],
    ordersPlaced: 0,
    lifetimeValue: { minorUnits: 0, currency: "INR" },
    lat: null,
    lng: null,
    photoUrl: null,
  };
}
