import "server-only";

import type { Channel, ReminderStage, Subscribed } from "@/lib/domain/subscription-reminder";
import { CHANNELS } from "@/lib/domain/subscription-reminder";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Every subscription on the platform, across every kind of account.
 *
 * The accounts sold plans and operations could not see a single one. There was
 * no page, no count and no query — the only way to answer "who is paying us and
 * when do they lapse" was to open Firestore. A platform that cannot see its own
 * revenue cannot chase a renewal, and cannot tell an angry caller why they were
 * locked out this morning.
 *
 * Four reads, because a subscription lives on the account document rather than
 * in a collection of its own. That is right for the hot path — every guard that
 * needs it has already loaded the account — and it is what makes this read wide
 * rather than deep.
 */

const SOURCES: Array<{ collection: string; kind: string }> = [
  { collection: "farmers", kind: "Farmer" },
  { collection: "buyers", kind: "Buyer" },
  { collection: "franchises", kind: "Franchise" },
  { collection: "agencies", kind: "Agency" },
];

export interface SubscriptionRecord extends Subscribed {
  readonly kind: string;
  readonly amountMinor?: number;
  readonly startedAt?: Date;
  readonly reference?: string;
  readonly paymentMethod?: string;
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

export async function readSubscriptions(): Promise<SubscriptionRecord[]> {
  if (!hasAdminCredentials()) return [];

  try {
    const db = adminDb();
    const snapshots = await Promise.all(
      SOURCES.map(async (source) => ({
        source,
        docs: (await db.collection(source.collection).get()).docs,
      })),
    );

    return snapshots.flatMap(({ source, docs }) =>
      docs.flatMap((doc): SubscriptionRecord[] => {
        const data = doc.data();
        const sub = data.subscription as Record<string, unknown> | undefined;
        // An account that never subscribed is not a subscription with no plan;
        // it is absent, and padding the list with it would make every count on
        // the page describe accounts rather than revenue.
        if (!sub || typeof sub !== "object") return [];

        const term = str(sub.term) ?? str(sub.planId);

        return [
          {
            accountId: doc.id,
            collection: source.collection,
            kind: source.kind,
            name: str(data.name) ?? doc.id,
            mobile: str(data.mobile),
            email: str(data.email),
            status: str(sub.status) ?? "none",
            renewsAt: toDate(sub.renewsAt),
            startedAt: toDate(sub.startedAt) ?? toDate(sub.paidAt),
            term,
            // A lifetime plan has a renewal date a century out. Treating it as
            // an expiry would put it at the bottom of every "expiring" list
            // forever; treating it as lifetime keeps it out of them entirely.
            lifetime: term === "lifetime",
            reference: str(sub.reference),
            paymentMethod: str(sub.paymentMethod),
            amountMinor:
              typeof (sub.amount as { minorUnits?: unknown })?.minorUnits === "number"
                ? ((sub.amount as { minorUnits: number }).minorUnits)
                : undefined,
            remindersSent: Array.isArray(sub.remindersSent)
              ? (sub.remindersSent.filter(
                  (stage): stage is ReminderStage =>
                    typeof stage === "string" &&
                    ["far", "near", "last", "lapsed"].includes(stage),
                ))
              : [],
          },
        ];
      }),
    );
  } catch {
    return [];
  }
}

/**
 * Records that a reminder went out, so the next run does not repeat it.
 *
 * Appended to the subscription rather than kept in a table of its own: the
 * question "has this person been told" is only ever asked about one account,
 * and the answer belongs where the answer is used.
 */
export async function markReminded(
  collection: string,
  accountId: string,
  stage: ReminderStage,
  channels: readonly Channel[],
  at: Date,
): Promise<void> {
  if (!hasAdminCredentials()) return;

  const db = adminDb();
  const ref = db.collection(collection).doc(accountId);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;

    const sub = (snapshot.data()?.subscription ?? {}) as Record<string, unknown>;
    const sent = Array.isArray(sub.remindersSent) ? (sub.remindersSent as string[]) : [];
    if (sent.includes(stage)) return;

    transaction.update(ref, {
      "subscription.remindersSent": [...sent, stage],
      "subscription.lastReminderAt": at,
      "subscription.lastReminderChannels": channels.filter((c) =>
        (CHANNELS as readonly string[]).includes(c),
      ),
    });
  });
}
