import type { ReactNode } from "react";

import { AgencyNav } from "@/components/agency/agency-nav";
import { requireAgency } from "@/lib/auth/agency";
import { verifySession } from "@/lib/auth/session";
import { needsReview } from "@/lib/domain/admin";
import { driverAccounts, vehicles, workers } from "@/lib/mock/admin";

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
export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const { agency, email, service } = await requireAgency();
  const session = await verifySession();
  const now = new Date();

  const mine = <T extends { agencyId: string }>(rows: T[]) =>
    rows.filter((r) => r.agencyId === agency.id);

  const pending = {
    "/agency/workers": mine(workers(now)).filter((w) => needsReview(w.status)).length,
    "/agency/fleet": mine(vehicles(now)).filter((v) => needsReview(v.status)).length,
    "/agency/drivers": mine(driverAccounts(now)).filter((d) => needsReview(d.status))
      .length,
  };

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
    </div>
  );
}
