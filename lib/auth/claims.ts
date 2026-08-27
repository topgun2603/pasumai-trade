/**
 * What the platform knows about whoever is asking.
 *
 * These are Firebase custom claims, set on the user record by operations and
 * carried inside the ID token. They are the same three the Security Rules were
 * written against long before any of this existed — `firestore.rules` reads
 * `role`, `accountId` and `districts` and has been matching nobody until now.
 *
 * Claims and not a Firestore lookup, for two reasons: they are signed, so a
 * route handler can trust them without a read; and Security Rules can see them,
 * which a Firestore document could not help with without a rules-level read on
 * every single query.
 *
 * The cost is that they are only as fresh as the token — up to an hour behind a
 * change, unless the session is refreshed. So they hold what changes rarely
 * (who someone is, what they may do) and never what changes often.
 *
 * No React and no Firebase imports here on purpose: this is shared by the
 * server that mints claims and the client that reads a session.
 */

/**
 * Six roles, one per door on the public site.
 *
 * Franchise and buyer share every capability, and so do transport and manpower
 * — but they are kept apart deliberately. A labour contractor signing in is not
 * a "generic agency", and the day the two diverge (different verification,
 * different rates, different console sections) the split already exists rather
 * than needing to be unpicked from every call site at once.
 *
 * The cost is that a firm doing both transport and manpower holds two logins.
 * In practice those are two different people at that firm anyway.
 */
export const ROLES = [
  "admin",
  "franchise",
  "buyer",
  "transport",
  "manpower",
  "farmer",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Operations",
  franchise: "Franchise",
  buyer: "Buyer",
  transport: "Transportation",
  manpower: "Manpower",
  farmer: "Farmer",
};

/** Roles that buy produce. Both see the same console. */
export const BUYING_ROLES = ["franchise", "buyer"] as const;

/** Roles that supply people or vehicles. Both see the agency console. */
export const AGENCY_ROLES = ["transport", "manpower"] as const;

export function isBuyingRole(role: Role): boolean {
  return (BUYING_ROLES as readonly Role[]).includes(role);
}

export function isAgencyRole(role: Role): boolean {
  return (AGENCY_ROLES as readonly Role[]).includes(role);
}

export interface Claims {
  readonly role: Role;
  /**
   * The account document this user *is* — a buyer id, a farmer id.
   *
   * Absent for operations, who are not an account on the platform. Every rule
   * that scopes a read to "your own records" compares against this.
   */
  readonly accountId?: string;
  /** Districts a buyer may source from. Empty means unrestricted. */
  readonly districts?: readonly string[];
}

/**
 * Where each role lands after signing in.
 *
 * A buyer sent to `/admin` would get a refusal, so each role names its own
 * landing page and nothing hardcodes one.
 *
 * Home, not the overview. This was the other way round on the argument that a
 * tap between somebody and their work is a cost paid every morning — and it
 * is, but the greeting is what makes a console somebody's rather than a set of
 * screens, and the continue control on it is one tap rather than a wall.
 */
export const HOME_FOR_ROLE: Record<Role, string> = {
  // Operations have no Home page. They are not an account on the platform and
  // there is no welcome to give them; the overview is the work.
  admin: "/admin",
  franchise: "/home",
  buyer: "/home",
  transport: "/agency/home",
  manpower: "/agency/home",
  farmer: "/farm/home",
};

/**
 * Reads claims off a decoded token, refusing anything unrecognised.
 *
 * A token with no role, or a role this build does not know, yields `null`
 * rather than a default. Defaulting an unknown role to the least privilege
 * would be a silent downgrade; defaulting to anything else would be a silent
 * escalation. Neither belongs here — the caller treats `null` as "not signed
 * in" and the person is sent back to sign in.
 */
export function readClaims(token: Record<string, unknown>): Claims | null {
  const role = token.role;
  if (!isRole(role)) return null;

  const accountId =
    typeof token.accountId === "string" && token.accountId ? token.accountId : undefined;

  const districts = Array.isArray(token.districts)
    ? token.districts.filter((d): d is string => typeof d === "string")
    : undefined;

  // A buyer with no account is not a usable identity: every read scoped to
  // "their own orders" would match nothing, and the console would show an
  // empty platform rather than an error.
  // An agency with no account id would see every other agency's workers,
  // because every query it makes is scoped by exactly this value.
  if (role !== "admin" && !accountId) return null;

  return { role, accountId, districts };
}

/**
 * May this role reach this path?
 *
 * Note what this is *not*: nothing calls it, and the console layouts do the
 * enforcing — `requireConsole` on `(admin)`, `(franchise)`, `(agency)` and
 * `(farm)`, plus `(operations)` nested inside `(admin)`. Kept because it is
 * the one place the whole map is legible at once, and corrected alongside the
 * layouts so it cannot quietly become a description of a policy that has
 * changed. A function that reads like a permission check and returns a stale
 * answer is worse than no function at all.
 */
export function mayAccess(role: Role, pathname: string): boolean {
  if (role === "admin") return true;

  // A franchise used to be excepted here — they read the admin console, which
  // a buyer may not. They no longer do, so franchise and buyer answer the same
  // way and the exception has gone rather than being left as a branch that
  // reads like a rule and matches nothing.
  if (isBuyingRole(role)) return !pathname.startsWith("/admin");
  if (isAgencyRole(role)) return pathname.startsWith("/agency");
  if (role === "farmer") return pathname.startsWith("/farm");
  return false;
}
