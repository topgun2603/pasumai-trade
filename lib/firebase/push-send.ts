import "server-only";

import { getMessaging } from "firebase-admin/messaging";

import { describe, type Notification } from "@/lib/domain/notification";
import { isDeadToken, isPushable } from "@/lib/domain/push";

import { adminApp, adminDb, hasAdminCredentials } from "./admin";

/**
 * Sending a push to whatever devices an account has registered.
 *
 * Best effort, always. A push is a courtesy on top of a notification that is
 * already stored and already on the bell — if the send fails, the farmer still
 * finds it when they next open the app, and failing the bargain because a
 * phone was unreachable would be absurd.
 *
 * The body is built with the same `describe` the bell uses, in the account's
 * own language, so a farmer's phone shows Tamil and a buyer's shows English
 * from one stored row.
 */

/** Where the account's registered devices live. See `push.ts`. */
function tokensOf(accountId: string) {
  return adminDb().collection("accounts").doc(accountId).collection("pushTokens");
}

export async function sendPush(
  notification: Notification,
  locale: string,
): Promise<void> {
  if (!hasAdminCredentials()) return;

  // Not everything in the bell earns an interruption — see `isPushable`.
  if (!isPushable(notification.kind)) return;

  try {
    const registered = await tokensOf(notification.accountId).get();
    const tokens = registered.docs
      .map((doc) => String(doc.data().token ?? ""))
      .filter(Boolean);

    if (tokens.length === 0) return;

    const messaging = getMessaging(adminApp());

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "Pasumai Trade",
        body: describe(notification, locale),
      },
      // Read by the service worker so a tap opens the right screen rather than
      // the home page.
      data: { href: notification.href, kind: notification.kind },
      webpush: {
        fcmOptions: { link: notification.href },
        notification: {
          // Collapsed per bargain, so ten messages on one thread do not become
          // ten entries in the tray.
          tag: notification.subject.negotiationId ?? notification.kind,
          icon: "/icon-192.png",
        },
      },
    });

    /*
      Prune what the service says is gone.

      A token dies when a browser reissues it or a device is wiped, and a dead
      one never recovers — keeping it means every future send has a guaranteed
      failure in it. Only the codes that actually mean "this device is gone" are
      pruned; a network wobble must not quietly unsubscribe somebody's phone.
    */
    const dead = response.responses
      .map((result, i) => (isDeadToken(result.error?.code) ? tokens[i] : null))
      .filter((token): token is string => token !== null);

    if (dead.length > 0) {
      const batch = adminDb().batch();
      for (const doc of registered.docs) {
        if (dead.includes(String(doc.data().token ?? ""))) batch.delete(doc.ref);
      }
      await batch.commit();
    }
  } catch (error) {
    console.error("push not sent", { accountId: notification.accountId, error });
  }
}

/** Several at once, without letting one failure stop the rest. */
export async function sendPushes(
  notifications: readonly Notification[],
  localeFor: (audience: Notification["audience"]) => string,
): Promise<void> {
  await Promise.all(
    notifications.map((n) => sendPush(n, localeFor(n.audience))),
  );
}
