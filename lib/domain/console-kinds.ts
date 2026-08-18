import type { Role } from "@/lib/auth/claims";

/**
 * The five kinds of account operations can look into.
 *
 * ## Why this is a view rather than a way in
 *
 * The obvious build is to let an operator open the client's own console. It
 * does not work and should not: every console reads `session.claims.accountId`,
 * and an admin has none — so an operator opening `/listings` today sees an
 * empty market rather than the buyer's. Making it work would mean either
 * threading a borrowed identity through every page, or minting a session as
 * somebody else.
 *
 * Both are worse than they look. A borrowed identity is a permission check that
 * has to be right in fifty places instead of one. A minted session is
 * impersonation: every write from that point is indistinguishable from the
 * client's own, in a system whose whole argument is that a farmer and a buyer
 * settle a price between themselves. An operator who can act *as* a farmer can
 * accept a price on their behalf, and no record would show it was not them.
 *
 * So this is a **read-only dossier**: one page per account holding everything
 * the platform knows about them, assembled from the same collections the
 * client's own screens read. It answers the question an operator actually has
 * — "what is going on with this account" — better than the client's console
 * would, because it is one page rather than six.
 */

export const CONSOLE_KINDS = [
  "farmers",
  "buyers",
  "franchises",
  "transport",
  "manpower",
] as const;

export type ConsoleKind = (typeof CONSOLE_KINDS)[number];

export function isConsoleKind(value: string): value is ConsoleKind {
  return (CONSOLE_KINDS as readonly string[]).includes(value);
}

export interface ConsoleDefinition {
  readonly kind: ConsoleKind;
  /** Plural, as a heading. */
  readonly label: string;
  /** Singular, for one record. */
  readonly one: string;
  /** The Firestore collection the accounts live in. */
  readonly collection: string;
  readonly role: Role;
  /** One line saying what this kind of account does, for the directory header. */
  readonly blurb: string;
  /**
   * Three or four words, for the menu row under the label.
   *
   * Separate from `blurb` rather than truncated from it: a sentence cut short
   * ends mid-thought, and this one has to land in the time it takes to run an
   * eye down five rows.
   */
  readonly short: string;
}

/*
  Transport and manpower share the `agencies` collection — an agency document
  carries no role, and the two are told apart only by the claim on whoever signs
  in. They are listed separately anyway, because an operator looking for a
  labour contractor is not looking for a lorry firm, and merging them would put
  every crew supplier in a list headed "Transport".
*/
export const CONSOLES: Record<ConsoleKind, ConsoleDefinition> = {
  farmers: {
    kind: "farmers",
    label: "Farmers",
    one: "Farmer",
    collection: "farmers",
    role: "farmer",
    blurb: "Growers who list produce and settle prices with buyers.",
    short: "Growers who list produce",
  },
  buyers: {
    kind: "buyers",
    label: "Buyers",
    one: "Buyer",
    collection: "buyers",
    role: "buyer",
    blurb: "Businesses buying produce in bulk.",
    short: "Businesses buying in bulk",
  },
  franchises: {
    kind: "franchises",
    label: "Franchises",
    one: "Franchise",
    collection: "franchises",
    role: "franchise",
    blurb: "Contracted franchises. They buy, and they onboard farmers and dispatch vehicles.",
    short: "Buy, onboard and dispatch",
  },
  transport: {
    kind: "transport",
    label: "Transport",
    one: "Transport agency",
    collection: "agencies",
    role: "transport",
    blurb: "Agencies supplying vehicles and drivers for collection runs.",
    short: "Vehicles and drivers",
  },
  manpower: {
    kind: "manpower",
    label: "Manpower",
    one: "Manpower agency",
    collection: "agencies",
    role: "manpower",
    blurb: "Agencies supplying loading, grading and weighing crews.",
    short: "Loading and grading crews",
  },
};

export function consoleFor(kind: ConsoleKind): ConsoleDefinition {
  return CONSOLES[kind];
}
