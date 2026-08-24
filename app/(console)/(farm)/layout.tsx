import type { ReactNode } from "react";

import { TickerSlot } from "@/components/market/ticker-slot";
import { GateProvider } from "@/components/console/gate-dialog";
import { ServiceWorker } from "@/components/console/service-worker";
import { stateNameForDistrict } from "@/lib/domain/india";
import { ConsoleTour } from "@/components/console/tour";
import { FarmNav } from "@/components/farm/farm-nav";
import { requireFarmer } from "@/lib/auth/farm";
import { tourFor } from "@/lib/domain/tour";
import { consoleDictionary } from "@/lib/i18n/console";
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
  const [feed, seenTours, { locale, t }] = await Promise.all([
    readNotifications(farmer.id),
    readSeenTours(farmer.id),
    // Reads a cookie rather than the database, so it costs nothing and a
    // farmer who has just switched sees it on this render.
    consoleDictionary(),
  ]);

  const definition = tourFor("farmer");
  const tour = definition && !seenTours.has(definition.id) ? definition : null;

  return (
    <div className="flex min-h-svh w-full">
      <FarmNav
        farmer={{ name: farmer.name, id: farmer.id, village: farmer.village }}
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
        locale={locale}
        t={t}
      />
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        {/*
          Scoped to wherever this farmer is, and read in their language. The
          district is the only geography on the account, so the state comes
          from it — and where the district name belongs to two states, the
          default is shown rather than a confident guess.
        */}
        <TickerSlot
          state={stateNameForDistrict(farmer.district)}
          locale={locale}
          label={t.farm.nav.prices}
        />
        <GateProvider console="farm">{children}</GateProvider>
      </div>
      {/* First run only. `readSeenTours` is one extra document read on a
          console page; it rides the same parallel batch as the notification
          feed, so it costs a read rather than a round trip. */}
      {tour ? <ConsoleTour tour={tour} /> : null}

      {/* Makes this console installable, and gives it a page to show when the
          signal goes. See components/console/service-worker.tsx. */}
      <ServiceWorker />
    </div>
  );
}
