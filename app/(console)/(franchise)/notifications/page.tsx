import { BellIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { isCapped, readNotifications } from "@/lib/firebase/notifications-read";

export const metadata: Metadata = { title: "Notifications" };

/**
 * What has happened, for a buyer.
 *
 * The same records the farmer sees, from the other end and in English — a
 * notification stores a kind and a few facts, never a sentence, so the language
 * is the reader's rather than the writer's.
 *
 * Scoped to the session's account. Operations reach this page too and see their
 * own, which is usually nothing: notifications belong to the two sides of a
 * trade, and operations are neither.
 */
export default async function NotificationsPage() {
  await connection();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const feed = await readNotifications(session.claims.accountId ?? "");

  return (
    <>
      <PageHeader
        title="Notifications"
        description="New produce in your districts, bargains, settled prices and transport."
        aside={
          <p className="text-faint text-xs">
            {feed.unread}
            {isCapped(feed) ? "+" : ""} unread · {feed.notifications.length} shown
          </p>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
          {feed.notifications.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-14 text-center">
              <BellIcon className="size-7" />
              <p className="max-w-sm text-sm">
                Nothing yet. Lots posted in the districts you cover, replies to
                your bargains and settled prices appear here.
              </p>
            </div>
          ) : (
            <NotificationList notifications={feed.notifications} locale="en" />
          )}
        </div>
      </div>
    </>
  );
}
