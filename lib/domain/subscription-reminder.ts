/**
 * Telling somebody their subscription is about to end.
 *
 * The platform sold subscriptions and then never mentioned them again. A farmer
 * whose year lapses finds out by trying to list produce and being refused —
 * which is the worst possible moment, because the crop is already cut.
 *
 * ## Why a ladder rather than one reminder
 *
 * One message can be missed, and on this platform "missed" is likely: a farmer
 * may not open the app for a fortnight. So reminders go out at a few distances
 * from the end, each one closer, and the last one after expiry — because
 * somebody who has already lapsed is the person most in need of being told, and
 * the one a single pre-expiry reminder never reaches.
 *
 * ## Why it is idempotent
 *
 * The job that sends these will run on a schedule, and a schedule that runs
 * twice is normal — a retry, an overlap, an operator running it by hand. Every
 * decision here is a pure function of the subscription and the date, and each
 * reminder carries a stage that has been sent or has not. Running the job five
 * times in an hour sends nothing extra.
 */

export type ReminderStage = "far" | "near" | "last" | "lapsed";

export interface ReminderPlan {
  readonly stage: ReminderStage;
  /** Days before expiry it goes out. Negative means after. */
  readonly daysBefore: number;
}

/**
 * The default ladder.
 *
 * Configurable in Controls — see `subscriptionReminderDays` in the policy —
 * because how far ahead to warn is a commercial decision, not a technical one.
 * A platform that renews annually wants a month's notice; one selling monthly
 * plans would be nagging.
 */
export const DEFAULT_LADDER: readonly ReminderPlan[] = [
  { stage: "far", daysBefore: 14 },
  { stage: "near", daysBefore: 7 },
  { stage: "last", daysBefore: 1 },
  // After it ends, not before. The person who has already lapsed is the one a
  // pre-expiry reminder never reached.
  { stage: "lapsed", daysBefore: -1 },
];

/**
 * The ladder operations configured, as rungs.
 *
 * A rung set to zero is off — which is why zero is filtered out rather than
 * treated as "on the day it expires". Somebody switching a reminder off in
 * Controls means off, and the day-of case is what the final rung is for.
 */
export function ladderFrom(policy: {
  reminderFarDays: number;
  reminderNearDays: number;
  reminderLastDays: number;
  reminderLapsedDays: number;
}): ReminderPlan[] {
  return [
    { stage: "far" as const, daysBefore: policy.reminderFarDays },
    { stage: "near" as const, daysBefore: policy.reminderNearDays },
    { stage: "last" as const, daysBefore: policy.reminderLastDays },
    { stage: "lapsed" as const, daysBefore: -policy.reminderLapsedDays },
  ].filter((plan) => plan.daysBefore !== 0);
}

export interface Subscribed {
  readonly accountId: string;
  readonly collection: string;
  readonly name: string;
  readonly mobile?: string;
  readonly email?: string;
  readonly status: string;
  readonly renewsAt?: Date;
  readonly term?: string;
  /** Stages already sent, so a rerun sends nothing twice. */
  readonly remindersSent?: readonly ReminderStage[];
  /** A lifetime plan never expires and is never reminded. */
  readonly lifetime?: boolean;
}

/** Whole days from `now` until it lapses. Negative once it has. */
export function daysLeft(subscription: Subscribed, now: number): number | null {
  if (!subscription.renewsAt) return null;
  return Math.floor((subscription.renewsAt.getTime() - now) / 86_400_000);
}

/**
 * Which stage this subscription is in, given the ladder.
 *
 * The *closest* stage whose threshold has been passed, not every one — a
 * subscription three days out has passed both the fourteen-day and seven-day
 * marks, and sending both would be two messages for one fact. Reruns are
 * absorbed by `remindersSent`, but the ladder itself must not double up.
 */
export function stageFor(
  subscription: Subscribed,
  now: number,
  ladder: readonly ReminderPlan[] = DEFAULT_LADDER,
): ReminderStage | null {
  const left = daysLeft(subscription, now);
  if (left === null) return null;

  // Nearest threshold first, so the most urgent applicable stage wins.
  const ordered = [...ladder].sort((a, b) => a.daysBefore - b.daysBefore);
  for (const plan of ordered) {
    if (left <= plan.daysBefore) return plan.stage;
  }
  return null;
}

/**
 * Everything that should be told something today.
 *
 * A lifetime plan is never included: it has no end, and a "your plan expires
 * soon" message to somebody who paid once to never be asked again is the most
 * annoying message this platform could send.
 *
 * Nor is anything already cancelled. They chose to stop, and chasing them is a
 * different conversation from reminding somebody who simply has not renewed.
 */
export function due(
  subscriptions: readonly Subscribed[],
  now: number,
  ladder: readonly ReminderPlan[] = DEFAULT_LADDER,
): Array<{ subscription: Subscribed; stage: ReminderStage }> {
  return subscriptions.flatMap((subscription) => {
    if (subscription.lifetime) return [];
    if (subscription.status === "cancelled") return [];

    const stage = stageFor(subscription, now, ladder);
    if (!stage) return [];
    if ((subscription.remindersSent ?? []).includes(stage)) return [];

    return [{ subscription, stage }];
  });
}

/* -------------------------------------------------------------------------
   Channels
   ------------------------------------------------------------------------- */

export const CHANNELS = ["inApp", "push", "sms", "whatsapp", "email"] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  inApp: "In-app",
  push: "Push",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

/**
 * Which channels can carry a reminder to this person.
 *
 * An address the platform does not hold is not a channel. Asking to send an
 * email to somebody with no email address is how a job reports "sent" for a
 * message nobody received — and in-app is always available, because it needs
 * nothing but an account.
 */
export function reachable(subscription: Subscribed, enabled: readonly Channel[]): Channel[] {
  return enabled.filter((channel) => {
    switch (channel) {
      case "inApp":
      case "push":
        return true;
      case "sms":
      case "whatsapp":
        return Boolean(subscription.mobile);
      case "email":
        return Boolean(subscription.email);
    }
  });
}

/** How urgent the message should sound, without translating it here. */
export const STAGE_URGENCY: Record<ReminderStage, "notice" | "warning" | "urgent"> = {
  far: "notice",
  near: "notice",
  last: "warning",
  lapsed: "urgent",
};
