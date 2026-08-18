import type { ReactNode } from "react";

import { AgencyNav } from "@/components/agency/agency-nav";
import { ConsoleTour } from "@/components/console/tour";
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
  const session = await verifySession();

  const mine = <T extends { agencyId: string }>(rows: T[]) =>
    rows.filter((r) => r.agencyId === agency.id);

  const pending = {
    "/agency/workers": mine(await readWorkers()).filter((w) =>
      needsReview(w.status),
    ).length,
    "/agency/fleet": mine(await readVehicles()).filter((v) =>
      needsReview(v.status),
    ).length,
    "/agency/drivers": mine(await readDrivers()).filter((d) =>
      needsReview(d.status),
    ).length,
  };

  /*
    Transport and manpower share this shell and this collection, and their tours
    differ — one is about lorries and licences, the other about who can be sent
    out. The role on the session is the only thing that tells them apart.
  */
  const definition = tourFor(session!.claims.role);
  const tour =
    definition && !(await readSeenTours(agency.id)).has(definition.id)
      ? definition
      : null;

  return (
    <div className="flex min-h-svh w-full">
      <AgencyNav
        agency={{ name: agency.name, id: agency.id }}
        service={service}
        role={session!.claims.role}
        session={{ email }}
        pending={pending}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {/* First run only. See `lib/firebase/tour-read.ts` for where the flag lives. */}
      {tour ? <ConsoleTour tour={tour} /> : null}
    </div>
  );
}
