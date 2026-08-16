import "server-only";

import {
  NOTIFICATION_KINDS,
  type Notification,
  type NotificationAudience,
  type NotificationKind,
} from "@/lib/domain/notification";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * One account's notifications.
 *
 * They live under `accounts/{accountId}/notifications`, so the scope is the
 * path rather than a filter somebody has to remember. The account id comes
 * from the session — never from a URL or a request body. A notification names a
 * counterparty, a crop and a quantity, and getting that scoping wrong would
 * turn one query into a feed of the whole platform's business.
 *
 * Being a subcollection also means the ordinary read needs no composite index:
 * there is nothing left to filter on, only `createdAt` to sort by.
 *
 * Read on the server rather than by a client listener, for the same reason the
 * bargain stream is: the browser signs in with `inMemoryPersistence` and holds
 * no Firebase auth, so a client query would arrive unauthenticated and be
 * refused by the rules.
 */

/** How many to carry into a page or a dropdown. */
const PAGE = 50;

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

function toOptionalDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) return undefined;
  return toDate(value);
}

function shape(id: string, data: Record<string, unknown>): Notification | null {
  const kind = data.kind;
  // A kind this build does not know has no copy to render, so it would appear
  // as a blank row. Dropped instead — a deploy that rolls back should not fill
  // somebody's list with empty lines.
  if (typeof kind !== "string" || !NOTIFICATION_KINDS.includes(kind as NotificationKind)) {
    return null;
  }

  const subject = (data.subject ?? {}) as Record<string, unknown>;

  return {
    id,
    accountId: String(data.accountId ?? ""),
    audience: (data.audience === "buyer" ? "buyer" : "farmer") as NotificationAudience,
    kind: kind as NotificationKind,
    subject: {
      produceName: typeof subject.produceName === "string" ? subject.produceName : undefined,
      quantity: typeof subject.quantity === "number" ? subject.quantity : undefined,
      unit: typeof subject.unit === "string" ? subject.unit : undefined,
      counterparty:
        typeof subject.counterparty === "string" ? subject.counterparty : undefined,
      listingId: typeof subject.listingId === "string" ? subject.listingId : undefined,
      negotiationId:
        typeof subject.negotiationId === "string" ? subject.negotiationId : undefined,
      orderId: typeof subject.orderId === "string" ? subject.orderId : undefined,
      agencyName: typeof subject.agencyName === "string" ? subject.agencyName : undefined,
    },
    href: typeof data.href === "string" ? data.href : "/",
    createdAt: toDate(data.createdAt),
    readAt: toOptionalDate(data.readAt),
  };
}

export interface NotificationFeed {
  readonly notifications: Notification[];
  readonly unread: number;
}

/**
 * The feed for one account, newest first.
 *
 * Returns an empty feed rather than throwing when there are no Admin
 * credentials or the query fails. A bell that cannot count is a bell showing
 * nothing; a console that will not render because the bell is unhappy is a
 * console nobody can use.
 */
export async function readNotifications(accountId: string): Promise<NotificationFeed> {
  if (!accountId || !hasAdminCredentials()) return { notifications: [], unread: 0 };

  try {
    const snapshot = await adminDb()
      .collection("accounts")
      .doc(accountId)
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(PAGE)
      .get();

    const notifications = snapshot.docs
      .map((doc) => shape(doc.id, doc.data()))
      .filter((n): n is Notification => n !== null);

    return {
      notifications,
      // Counted from the page rather than with a second query. The bell says
      // "50+" past that, which is the honest reading of a list nobody has
      // touched in weeks — an exact count of an unread pile that large is not
      // a number anybody acts on.
      unread: notifications.filter((n) => n.readAt === undefined).length,
    };
  } catch (error) {
    console.error("notifications unreadable", error);
    return { notifications: [], unread: 0 };
  }
}

/** True when the feed was capped, so the count is a floor rather than a total. */
export function isCapped(feed: NotificationFeed): boolean {
  return feed.notifications.length >= PAGE;
}
