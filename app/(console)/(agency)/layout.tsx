import type { ReactNode } from "react";

import { TickerSlot } from "@/components/market/ticker-slot";
import { GateProvider } from "@/components/console/gate-dialog";
import { AgencyNav } from "@/components/agency/agency-nav";
import { ConsoleTour } from "@/components/console/tour";
import { stateNameForDistrict } from "@/lib/domain/india";
import { isCapped, readNotifications } from "@/lib/firebase/notifications-read";
import { consoleLocale } from "@/lib/i18n/console";
import { requireAgency } from "@/lib/auth/agency";
import { verifySession } from "@/lib/auth/session";
import { needsReview } from "@/lib/domain/admin";
import { tourFor } from "@/lib/domain/tour";
import {
  readDrivers,
  readVehicles,
  readWorkers,
} from "@/lib/firebase/roster-read";
import { readSeenTours } from "@/lib/firebase/tour-read";

/**
 * The agency console shell.
 *
 * Gated on the layout, so a route added under `(agency)` next week is scoped to
 * the signed-in tenant the moment it exists rather than the moment somebody
 * remembers.
 *
 * Every count here is filtered by the agency's own id from the session. There
 * is no code path that takes an agency id from the request.
 */
export default async function AgencyLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { agency, email, service } = await requireAgency();
  // The rail reads in the owner's own language, like the farm one.
  const locale = await consoleLocale();

  // The bell is on every screen, so the unread count is read here rather than
  // on the notifications page — a count only visible once you have arrived is
  // a count nobody sees.
  const feed = await readNotifications(agency.id);
  const session = await verifySession();

  const mine = <T extends { agencyId: string }>(rows: T[]) =>
    rows.filter((r) => r.agencyId === agency.id);

  /*
    Together, not one after another. Written as three awaits inside an object
    literal these ran in series — JavaScript evaluates properties in order — so
    a rail badge cost three round trips to a database in another continent on
    every page of this console.
  */
  const [workers, vehicles, drivers, seenTours] = await Promise.all([
    readWorkers(),
    readVehicles(),
    readDrivers(),
    // In the same batch: the tour flag is one document, and reading it after
    // the rest would add a whole round trip to save nothing.
    readSeenTours(agency.id),
  ]);

  const pending = {
    "/agency/workers": mine(workers).filter((w) => needsReview(w.status))
      .length,
    "/agency/fleet": mine(vehicles).filter((v) => needsReview(v.status)).length,
    "/agency/drivers": mine(drivers).filter((d) => needsReview(d.status))
      .length,
  };

  /*
    Transport and manpower share this shell and this collection, and their tours
    differ — one is about lorries and licences, the other about who can be sent
    out. The role on the session is the only thing that tells them apart.
  */
  const definition = tourFor(session!.claims.role);
  const tour = definition && !seenTours.has(definition.id) ? definition : null;

  return (
    <div className="flex min-h-svh w-full">
      <AgencyNav
        agency={{ name: agency.name, id: agency.id }}
        notifications={{
          rows: feed.notifications,
          unread: feed.unread,
          capped: isCapped(feed),
        }}
        session={{ email }}
        role={session!.claims.role}
        service={service}
        locale={locale}
        pending={pending}
      />
      {/* `pt-12` for the fixed app bar, which is out of flow — see
        components/console/app-bar.tsx. Dropped at `md`, where the bar is
        hidden and the rail takes over. */}
      <div className="flex min-w-0 flex-1 flex-col pt-12 md:pt-0">
        <TickerSlot state={stateNameForDistrict(agency.district)} />
        <GateProvider console="agency">{children}</GateProvider>
      </div>
      {/* First run only. See `lib/firebase/tour-read.ts` for where the flag lives. */}
      {tour ? <ConsoleTour tour={tour} /> : null}
    </div>
  );
}
