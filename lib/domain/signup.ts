
import {
  checkEmail,
  checkMobile,
  checkPincode,
  required,
  type FieldErrors,
} from "./registration";
import { isDistrictOf, stateById } from "@/lib/domain/india";

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
  /*
    Its own collection, not `buyers`.

    The two shared one for as long as they were thought to be the same thing.
    They are not: a franchise onboards farmers and dispatches vehicles, and a
    buyer does neither. Keeping both in `buyers` meant every read of "our
    buyers" silently included franchises, every count was wrong in the same
    direction, and the two could never be given different fields without a
    `kind` check at each site.
  */
  franchise: "franchises",
  buyer: "buyers",
  transport: "agencies",
  manpower: "agencies",
  farmer: "farmers",
};

/** Id prefix, matching the convention the seeded records already use. */
const PREFIX: Record<SignupRole, string> = {
  franchise: "FR",
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
  /** Village for a farmer, town otherwise. Free text: the finest level of
      Indian geography nobody maintains a list of. */
  place: string;
  /** A state id from `lib/domain/india.ts`, not the name people read. */
  state: string;
  district: string;
  pincode: string;
}

const MIN_PASSWORD = 8;

/**
 * Eight characters, with an upper case letter, a digit and a symbol.
 *
 * This replaces a twelve-character minimum with no composition rules, which was
 * argued for on the grounds that length resists guessing and that demanding a
 * symbol reliably produces `Password1!`. That argument still holds and the rule
 * is the one asked for, so it is written to be as useful as a rule of this
 * shape can be: the message names every part that is missing at once rather
 * than refusing once per rule, because being told about one requirement at a
 * time is how people end up at `Password1!`.
 */
const NEEDS = [
  { test: /[A-Z]/, want: "a capital letter" },
  { test: /[0-9]/, want: "a number" },
  { test: /[^A-Za-z0-9]/, want: "a symbol" },
] as const;

export function checkPassword(value: string): string | undefined {
  if (value === "") return "Password is required";

  const missing: string[] = [];
  if (value.length < MIN_PASSWORD) missing.push(`${MIN_PASSWORD} characters`);
  for (const { test, want } of NEEDS) if (!test.test(value)) missing.push(want);

  if (missing.length === 0) return undefined;

  // "8 characters, a capital letter and a number" rather than three refusals
  // in a row.
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return `Needs ${list}`;
}

/**
 * What it takes to open a login, and nothing else.
 *
 * Name, mobile and address used to be asked here, before the person had an
 * account or any reason to trust the form. They are asked once the login
 * exists, in the profile step every console is gated on — see
 * `lib/auth/require.ts`. A registration abandoned halfway now leaves a login
 * somebody can come back to rather than nothing at all.
 */
export interface SignupCredentials {
  email: string;
  password: string;
}

export function validateCredentials(
  values: SignupCredentials,
): FieldErrors<SignupCredentials> {
  return {
    email: checkEmail(values.email),
    password: checkPassword(values.password),
  };
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
    state: stateById(values.state) ? undefined : "Choose your state",
    /*
      The district has to belong to the state, not merely be a district.

      Both arrive from a browser and the pair is what gets stored, so "Erode,
      Punjab" would otherwise reach operations looking like something somebody
      meant. Checked here rather than only in the form, because the form is not
      what posts to the endpoint.
    */
    district: !values.district
      ? "District is required"
      : isDistrictOf(values.state, values.district)
        ? undefined
        : "Pick a district in the state you chose",
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
      state: values.state,
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
      state: values.state,
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
    state: values.state,
    districts: [values.district],
    ordersPlaced: 0,
    lifetimeValue: { minorUnits: 0, currency: "INR" },
    lat: null,
    lng: null,
    photoUrl: null,
  };
}
