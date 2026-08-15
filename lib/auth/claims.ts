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

export const ROLES = ["admin", "buyer", "farmer", "driver"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Operations",
  buyer: "Buyer",
  farmer: "Farmer",
  driver: "Driver",
};

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
 * A buyer sent to `/admin` would get a refusal, and a farmer has no console at
 * all yet — sending them somewhere that 404s would be worse than saying so.
 */
export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: "/admin",
  buyer: "/market",
  farmer: "/",
  driver: "/",
};

/** Roles with a console to sign into. The rest have accounts but nowhere to go. */
export function hasConsole(role: Role): boolean {
  return role === "admin" || role === "buyer";
}

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
  if ((role === "buyer" || role === "farmer") && !accountId) return null;

  return { role, accountId, districts };
}

/** May this role reach this path? Checked in the console layouts. */
export function mayAccess(role: Role, pathname: string): boolean {
  if (role === "admin") return true;
  if (role === "buyer") return !pathname.startsWith("/admin");
  return false;
}
