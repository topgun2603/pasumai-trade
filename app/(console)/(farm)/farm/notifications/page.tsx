import { BellIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { NotificationList } from "@/components/notifications/notification-list";
import { PushToggle } from "@/components/notifications/push-toggle";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { isCapped, readNotifications } from "@/lib/firebase/notifications-read";

export const metadata: Metadata = { title: "Notifications · Farmer" };

/**
 * What has happened, for a farmer.
 *
 * Written by the Cloud Functions in `functions/src/index.ts` rather than by the
 * screens that cause them, so a bargain settled by a script or by operations
 * reaches this list the same as one settled in the console. The document
 * changing is the event; nothing else is.
 *
 * Read in Tamil, matching the rest of the farmer surface. The rows carry a kind
 * and a few facts, never a sentence, so the same record renders in English on
 * the buyer's side.
 */
export default async function FarmNotificationsPage() {
  await connection();

  const { farmer } = await requireFarmer();
  const feed = await readNotifications(farmer.id);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Offers on your produce, settled bargains, orders and transport."
        aside={
          <p className="text-faint flex items-center gap-3 text-xs">
            <span>
              {feed.unread}
              {isCapped(feed) ? "+" : ""} unread · {feed.notifications.length} shown
            </span>
            {/* Asked for, never volunteered: a permission prompt nobody invited
                is the one people dismiss, and a dismissed prompt cannot be
                asked again. */}
            <PushToggle />
          </p>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
          {feed.notifications.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-14 text-center">
              <BellIcon className="size-7" />
              <p className="max-w-sm text-sm">
                Nothing yet. When a buyer bargains on your produce, a price is
                settled or a lorry is arranged, it appears here.
              </p>
            </div>
          ) : (
            <NotificationList notifications={feed.notifications} locale="ta" />
          )}
        </div>
      </div>
    </>
  );
}
