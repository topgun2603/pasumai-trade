import { notificationKey } from "@/lib/domain/notification-key";
import { readPolicy } from "@/lib/domain/policy";
import {
  CHANNELS,
  ladderFrom,
  reachable,
  due,
  type Channel,
  type ReminderStage,
} from "@/lib/domain/subscription-reminder";
import { adminDb, hasAdminCredentials } from "@/lib/firebase/admin";
import { writeNotifications } from "@/lib/firebase/notifications-write";
import { sendPushes } from "@/lib/firebase/push-send";
import { markReminded, readSubscriptions } from "@/lib/firebase/subscriptions-read";
import { configured, sendOn } from "@/lib/notify/channels";

/**
 * The periodic renewal reminder.
 *
 * Runs on a schedule — see `vercel.json` — and may safely run more often than
 * that. Every decision is a pure function of the subscription and today's date,
 * and each stage is recorded once it is sent, so a retry, an overlap or an
 * operator pressing the button twice all send nothing extra. That property is
 * the reason this is a GET with no body: there is no request that could make it
 * do something different.
 *
 * **Guarded by a shared secret, not a session.** A cron has no user to be. The
 * secret is compared in full rather than by prefix, and an absent secret fails
 * closed — a deployment that forgot to set it does not get an open endpoint
 * that anybody can use to spam every subscriber on the platform.
 */

export const dynamic = "force-dynamic";

type Result = {
  accountId: string;
  stage: ReminderStage;
  channels: Array<{ channel: Channel; state: string; reason?: string }>;
};

/** What each rung says, kept short because SMS is charged by the segment. */
function line(stage: ReminderStage, name: string, days: number): string {
  switch (stage) {
    case "far":
    case "near":
      return `${name}, your Pasumai Trade plan ends in ${days} day${days === 1 ? "" : "s"}. Renew to keep selling.`;
    case "last":
      return `${name}, your Pasumai Trade plan ends tomorrow. Renew today to avoid a break.`;
    case "lapsed":
      return `${name}, your Pasumai Trade plan has ended and you cannot trade. Renew to start again.`;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fails closed. An endpoint that anybody can call would let a stranger send
    // every subscriber on the platform a message in our name.
    return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  const offered = request.headers.get("authorization") ?? "";
  if (offered !== `Bearer ${secret}`) {
    return Response.json({ error: "Not for you." }, { status: 401 });
  }

  if (!hasAdminCredentials()) {
    return Response.json({ error: "No database credentials." }, { status: 503 });
  }

  const now = new Date();

  // The ladder operations configured, not the one this file shipped with.
  const settings = await adminDb().collection("settings").doc("policy").get();
  const policy = readPolicy(settings.data());
  const ladder = ladderFrom(policy);

  const subscriptions = await readSubscriptions();
  const owed = due(subscriptions, now.getTime(), ladder);

  const enabled = CHANNELS.filter((channel) => configured(channel));
  const results: Result[] = [];

  for (const { subscription, stage } of owed) {
    const days = Math.abs(
      Math.floor(((subscription.renewsAt?.getTime() ?? 0) - now.getTime()) / 86_400_000),
    );
    const text = line(stage, subscription.name, days);
    const href = subscription.collection === "farmers" ? "/farm/subscription" : "/subscription";

    const channels = reachable(subscription, enabled);
    const delivered: Result["channels"] = [];

    /*
      In-app first and always. It is the only channel that cannot fail for a
      reason outside this platform, so it is the one that guarantees the message
      exists somewhere the person can find it later.
    */
    const draft = {
      id: notificationKey([subscription.accountId, "renewal", stage], subscription.accountId),
      accountId: subscription.accountId,
      audience: (subscription.collection === "farmers" ? "farmer" : "buyer") as
        | "farmer"
        | "buyer",
      kind: "subscriptionEnding" as const,
      subject: { counterparty: subscription.term ?? "your plan", note: text },
      href,
    };

    await writeNotifications([draft]);
    delivered.push({ channel: "inApp", state: "sent" });

    if (channels.includes("push")) {
      await sendPushes([{ ...draft, createdAt: now }], () =>
        subscription.collection === "farmers" ? "ta" : "en",
      );
      delivered.push({ channel: "push", state: "sent" });
    }

    for (const channel of channels) {
      if (channel === "inApp" || channel === "push") continue;
      const outcome = await sendOn(channel, {
        accountId: subscription.accountId,
        name: subscription.name,
        mobile: subscription.mobile,
        email: subscription.email,
        text,
        href,
      });
      delivered.push({
        channel: outcome.channel,
        state: outcome.state,
        reason: "reason" in outcome ? outcome.reason : undefined,
      });
    }

    // Recorded only after the sending, so a crash halfway leaves the stage
    // unsent and the next run tries again — the safe direction for a message
    // somebody is waiting on.
    await markReminded(
      subscription.collection,
      subscription.accountId,
      stage,
      delivered.filter((d) => d.state === "sent").map((d) => d.channel),
      now,
    );

    results.push({ accountId: subscription.accountId, stage, channels: delivered });
  }

  return Response.json({
    ranAt: now.toISOString(),
    considered: subscriptions.length,
    reminded: results.length,
    /** Channels with no provider behind them, so the caller can see the gap. */
    unconfigured: CHANNELS.filter((channel) => !configured(channel)),
    results,
  });
}
