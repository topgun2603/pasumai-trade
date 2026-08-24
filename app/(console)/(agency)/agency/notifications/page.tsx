import { BellIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { NotificationList } from "@/components/notifications/notification-list";
import { PushToggle } from "@/components/notifications/push-toggle";
import { PageHeader } from "@/components/page-header";
import { requireAgency } from "@/lib/auth/agency";
import { isCapped, readNotifications } from "@/lib/firebase/notifications-read";
import { consoleLocale } from "@/lib/i18n/console";

export const metadata: Metadata = { title: "Notifications · Agency" };

/**
 * What has happened, for an agency.
 *
 * The console had none at all — no page and no bell — so a transport agency
 * learned a load was waiting by opening the board and looking, and learned
 * their verification had been decided by not being refused any more. Every
 * other role on the platform was told.
 *
 * The same records the farmer and the buyer read, scoped to this account and
 * rendered in whatever language the rail is being read in: a notification
 * stores a kind and a few facts, never a sentence.
 */
export default async function AgencyNotificationsPage() {
  await connection();

  const [{ agency }, locale] = await Promise.all([requireAgency(), consoleLocale()]);
  const feed = await readNotifications(agency.id);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Loads offered to you, documents decided, and anything else the platform needed to tell you."
        icon={<BellIcon className="text-muted-foreground size-5" />}
        aside={<PushToggle />}
      />
      <div className="p-5">
        <NotificationList notifications={feed.notifications} locale={locale} />
        {isCapped(feed) ? (
          // Said, rather than a list that quietly stops. A feed that ends
          // without explanation reads as nothing having happened before it.
          <p className="text-muted-foreground pt-3 text-xs">
            Older notifications are not kept.
          </p>
        ) : null}
      </div>
    </>
  );
}
