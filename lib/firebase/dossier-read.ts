import "server-only";

import { CONSOLES, type ConsoleKind } from "@/lib/domain/console-kinds";
import type { Check } from "@/lib/domain/kyc";

import { adminDb, hasAdminCredentials } from "./admin";
import { shapeChecks } from "./kyc-read";

/**
 * Everything the platform knows about one account, on one page.
 *
 * Assembled from the same collections the account's own screens read, rather
 * than from a summary written alongside them — a summary drifts, and the whole
 * point of this page is that an operator on the telephone can trust it.
 *
 * Read-only by construction. There is no write anywhere in this module and no
 * route that takes one: see the note in `lib/domain/console-kinds.ts` for why
 * looking at an account and acting as one are deliberately different things.
 */

export interface AccountSummary {
  readonly id: string;
  readonly name: string;
  readonly mobile?: string;
  readonly email?: string;
  readonly district?: string;
  readonly place?: string;
  readonly status: string;
  readonly registeredAt?: Date;
  /** Subscription status, or `none`. */
  readonly plan?: string;
  readonly planStatus?: string;
}

export interface DossierActivity {
  readonly listings: number;
  readonly openListings: number;
  readonly bargains: number;
  readonly agreedBargains: number;
  readonly orders: number;
  readonly pickups: number;
  readonly vehicles: number;
  readonly drivers: number;
  readonly workers: number;
  readonly notifications: number;
  readonly unreadNotifications: number;
}

export interface RecentRow {
  readonly id: string;
  readonly what: string;
  readonly detail: string;
  readonly at?: Date;
}

export interface Dossier {
  readonly account: AccountSummary;
  readonly checks: Check[];
  readonly activity: DossierActivity;
  readonly recent: RecentRow[];
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** Accounts of one kind, for the directory. */
export async function readAccountsOfKind(kind: ConsoleKind): Promise<AccountSummary[]> {
  if (!hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb().collection(CONSOLES[kind].collection).get();

    return snapshot.docs.map((doc): AccountSummary => {
      const data = doc.data();
      const sub = data.subscription as Record<string, unknown> | undefined;

      return {
        id: doc.id,
        name: str(data.name) ?? doc.id,
        mobile: str(data.mobile),
        email: str(data.email),
        district: str(data.district),
        place: str(data.village) ?? str(data.town) ?? str(data.place),
        status: str(data.status) ?? "pending",
        registeredAt: toDate(data.registeredAt) ?? toDate(data.createdAt),
        plan: str(sub?.term) ?? str(sub?.planId),
        planStatus: str(sub?.status),
      };
    });
  } catch {
    return [];
  }
}

/**
 * One account, and everything attached to it.
 *
 * Counts rather than full lists for most of it. An operator asking "what is
 * going on with this farmer" wants to know there are three open bargains before
 * they want to read them, and loading every message of every thread to render a
 * number would make the page slow for the ninety per cent of visits that never
 * open one.
 */
export async function readDossier(
  kind: ConsoleKind,
  accountId: string,
): Promise<Dossier | null> {
  if (!hasAdminCredentials()) return null;

  const db = adminDb();
  const definition = CONSOLES[kind];

  const snapshot = await db.collection(definition.collection).doc(accountId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data()!;
  const sub = data.subscription as Record<string, unknown> | undefined;

  const account: AccountSummary = {
    id: snapshot.id,
    name: str(data.name) ?? snapshot.id,
    mobile: str(data.mobile),
    email: str(data.email),
    district: str(data.district),
    place: str(data.village) ?? str(data.town) ?? str(data.place),
    status: str(data.status) ?? "pending",
    registeredAt: toDate(data.registeredAt) ?? toDate(data.createdAt),
    plan: str(sub?.term) ?? str(sub?.planId),
    planStatus: str(sub?.status),
  };

  /*
    Everything that references this account, read in parallel. Nine round trips
    to a database on another continent is worth doing at once rather than in
    sequence — the difference is a page that opens in two seconds and one that
    takes twelve.
  */
  const [listings, bargainsAsFarmer, bargainsAsBuyer, orders, pickups, vehicles, drivers, workers, notifications] =
    await Promise.all([
      db.collection("listings").where("farmerId", "==", accountId).get().catch(() => null),
      db.collection("negotiations").where("farmerId", "==", accountId).get().catch(() => null),
      db.collection("negotiations").where("buyerId", "==", accountId).get().catch(() => null),
      db.collection("buyerOrders").where("buyerId", "==", accountId).get().catch(() => null),
      db.collection("pickups").where("farmerId", "==", accountId).get().catch(() => null),
      db.collection("vehicles").where("agencyId", "==", accountId).get().catch(() => null),
      db.collection("drivers").where("agencyId", "==", accountId).get().catch(() => null),
      db.collection("workers").where("agencyId", "==", accountId).get().catch(() => null),
      db.collection("accounts").doc(accountId).collection("notifications").get().catch(() => null),
    ]);

  const bargainDocs = [
    ...(bargainsAsFarmer?.docs ?? []),
    ...(bargainsAsBuyer?.docs ?? []),
  ];

  const activity: DossierActivity = {
    listings: listings?.size ?? 0,
    openListings:
      listings?.docs.filter((d) => d.data().status !== "sold" && d.data().status !== "withdrawn")
        .length ?? 0,
    bargains: bargainDocs.length,
    agreedBargains: bargainDocs.filter((d) => d.data().status === "agreed").length,
    orders: orders?.size ?? 0,
    pickups: pickups?.size ?? 0,
    vehicles: vehicles?.size ?? 0,
    drivers: drivers?.size ?? 0,
    workers: workers?.size ?? 0,
    notifications: notifications?.size ?? 0,
    unreadNotifications: notifications?.docs.filter((d) => !d.data().readAt).length ?? 0,
  };

  /*
    A single timeline rather than a section per collection. What an operator
    needs on a telephone call is the order things happened in, not which table
    each fact came out of.
  */
  const recent: RecentRow[] = [
    ...(listings?.docs ?? []).map((doc) => ({
      id: `listing-${doc.id}`,
      what: "Listed produce",
      detail: `${str(doc.data().produceName) ?? "Produce"} · ${doc.data().quantity ?? 0} ${str(doc.data().unit) ?? ""}`.trim(),
      at: toDate(doc.data().createdAt),
    })),
    ...bargainDocs.map((doc) => ({
      id: `bargain-${doc.id}`,
      what: doc.data().status === "agreed" ? "Bargain agreed" : "Bargain opened",
      detail: `${str(doc.data().produceName) ?? "Produce"} · with ${
        str(doc.data().buyerId) === accountId
          ? (str(doc.data().farmerName) ?? "a farmer")
          : (str(doc.data().buyerName) ?? "a buyer")
      }`,
      at: toDate(doc.data().agreedAt) ?? toDate(doc.data().openedAt),
    })),
    ...(orders?.docs ?? []).map((doc) => ({
      id: `order-${doc.id}`,
      what: "Order placed",
      detail: `${str(doc.data().reference) ?? doc.id} · ${str(doc.data().status) ?? ""}`.trim(),
      at: toDate(doc.data().placedAt),
    })),
    ...(pickups?.docs ?? []).map((doc) => ({
      id: `pickup-${doc.id}`,
      what: "Asked for a vehicle",
      detail: `${str(doc.data().produceName) ?? "Produce"} · ${str(doc.data().status) ?? ""}`.trim(),
      at: toDate(doc.data().requestedAt),
    })),
  ]
    .filter((row) => row.at)
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, 25);

  return {
    account,
    checks: shapeChecks(data.kyc),
    activity,
    recent,
  };
}
