import type { ReactNode } from "react";

import { ConsoleTour } from "@/components/console/tour";
import { FarmNav } from "@/components/farm/farm-nav";
import { requireFarmer } from "@/lib/auth/farm";
import { tourFor } from "@/lib/domain/tour";
import { isCapped, readNotifications } from "@/lib/firebase/notifications-read";
import { readSeenTours } from "@/lib/firebase/tour-read";
import { negotiations } from "@/lib/mock/negotiations";

/**
 * The farmer console shell.
 *
 * Gated on the layout, so a route added under `(farm)` next week belongs to the
 * signed-in farmer the moment it exists rather than the moment somebody
 * remembers to add a check.
 *
 * `pb-20` on the content column leaves room for the fixed bottom bar on a
 * phone; without it the last row of every page sits underneath it.
 */
export default async function FarmLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { farmer, email } = await requireFarmer();
  const now = new Date().getTime();

  // Bargains where the buyer spoke last, so the farmer owes a reply. Filtered
  // by the farmer's own id, like everything else here.
  const waiting = negotiations(now).filter((thread) => {
    if (thread.farmerId !== farmer.id) return false;
    if (thread.status !== "open") return false;
    const last = thread.messages.at(-1);
    return last?.author === "buyer";
  }).length;

  // The unread count rides the same badge mechanism as the bargain one, so a
  // farmer sees a number on the rail without opening anything. Read here rather
  // than per page: the rail is on every screen, and a count that only appears
  // on the notifications page is a count nobody sees.
  const [feed, seenTours] = await Promise.all([
    readNotifications(farmer.id),
    readSeenTours(farmer.id),
  ]);

  const definition = tourFor("farmer");
  const tour = definition && !seenTours.has(definition.id) ? definition : null;

  return (
    <div className="flex min-h-svh w-full">
      <FarmNav
        farmer={{ name: farmer.name, id: farmer.id, village: farmer.village }}
        role="farmer"
        session={{ email }}
        pending={{
          "/farm/bargains": waiting,
          "/farm/notifications": feed.unread,
        }}
        notifications={{
          rows: feed.notifications,
          unread: feed.unread,
          capped: isCapped(feed),
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {children}
      </div>
      {/* First run only. `readSeenTours` is one extra document read on a
          console page; it rides the same parallel batch as the notification
          feed, so it costs a read rather than a round trip. */}
      {tour ? <ConsoleTour tour={tour} /> : null}
    </div>
  );
}
