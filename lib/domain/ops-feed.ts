/**
 * What is waiting on operations, in one list.
 *
 * The consoles for farmers and buyers have a notification bell fed by a
 * subcollection: something happens, a row is written, they read it. That model
 * does not fit here, and forcing it would be worse than not having one.
 *
 * A farmer's notification is addressed to a person — `accounts/{id}/
 * notifications`, and an admin has no account id to hang one off. More to the
 * point, a console's question is not "what happened" but **"what is still
 * mine"**, and those are different lists: an enquiry somebody already called is
 * an event that happened and is not work; an enquiry from three weeks ago that
 * nobody touched is not an event any more and is the most urgent thing on the
 * platform.
 *
 * So this is derived from the queues rather than written alongside them. It
 * cannot drift out of step with the truth, because it *is* the truth, read
 * again. Nothing has to be written when a check is approved for this list to
 * stop showing it.
 */

export type OpsKind = "enquiry" | "kyc" | "reupload";

export interface OpsItem {
  readonly id: string;
  readonly kind: OpsKind;
  /** Who or what it concerns, in words. */
  readonly title: string;
  readonly detail: string;
  /** When the clock started on it — an arrival, not a change. */
  readonly since: number;
  readonly href: string;
}

/**
 * How long is too long, per kind of work.
 *
 * Not one threshold for everything. Somebody who filled in a form expecting a
 * telephone call measures the wait in hours; a KYC submission was told to
 * expect two working days, and flagging it after one would cry wolf on every
 * row in the queue.
 */
export const OVERDUE_HOURS: Record<OpsKind, number> = {
  enquiry: 24,
  kyc: 48,
  reupload: 72,
};

export function isOverdue(item: OpsItem, now: number): boolean {
  return now - item.since >= OVERDUE_HOURS[item.kind] * 3_600_000;
}

/**
 * Oldest first, and overdue above everything.
 *
 * The ordering a queue needs rather than the one a feed usually has. A
 * notification list sorted newest-first buries the person who has waited
 * longest under the people who have waited least, which is exactly backwards
 * for work.
 */
export function inAttentionOrder(items: readonly OpsItem[], now: number): OpsItem[] {
  return [...items].sort((a, b) => {
    const overdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
    if (overdue !== 0) return overdue;
    return a.since - b.since;
  });
}

/** How many of each kind, for the tabs and the rail. */
export function countByKind(items: readonly OpsItem[]): Record<OpsKind, number> {
  const counts: Record<OpsKind, number> = { enquiry: 0, kyc: 0, reupload: 0 };
  for (const item of items) counts[item.kind] += 1;
  return counts;
}
