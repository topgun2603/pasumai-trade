import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { ConsoleTopBar } from "@/components/console/top-bar";
import { CONSOLES, CONSOLE_KINDS } from "@/lib/domain/console-kinds";
import { requireConsole } from "@/lib/auth/require";
import { needsReview } from "@/lib/domain/admin";
import { readKycAccounts } from "@/lib/firebase/kyc-read";
import { readBuyerAccounts, readDrivers, readFarmerAccounts, readVehicles, readWorkers } from "@/lib/firebase/roster-read";
import { openListings } from "@/lib/mock/listings";

/**
 * The platform admin shell.
 *
 * Counts of what is waiting are computed here rather than per page, so the rail
 * shows the same queue depth from wherever you are standing. Once Firestore
 * lands these become aggregation reads, not a scan.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireConsole(["admin"]);
  const now = new Date();

  /*
    Both counts the rail carries that mean somebody is waiting on us. Read
    together so the two badges cannot disagree about how much work there is.
  */
  /*
    Every count the rail carries, in one round trip's worth of wall clock.

    These five used to sit as `(await readBuyerAccounts())` inside the object
    literal below, which reads as a list and runs as a queue: JavaScript
    evaluates the properties in order, so each awaited a full collection before
    the next was even issued. Against Firestore in `nam5` that is five
    US round trips in series on *every* admin page, and it was most of the eight
    seconds the console took to answer.
  */
  const [
    kycAccounts,
    buyers,
    farmers,
    drivers,
    vehicles,
    workers,
  ] = await Promise.all([
    readKycAccounts(),
    readBuyerAccounts(),
    readFarmerAccounts(),
    readDrivers(),
    readVehicles(),
    readWorkers(),
  ]);

  const kycWaiting = kycAccounts.reduce(
    (total, account) =>
      total + account.checks.filter((check) => check.state === "review").length,
    0,
  );

  const pending = {
    "/admin/notifications": kycWaiting,
    "/admin/kyc": kycWaiting,
    "/admin/buyers": buyers.filter((a) => needsReview(a.status)).length,
    "/admin/farmers": farmers.filter((a) => needsReview(a.status)).length,
    "/admin/transport/drivers": drivers.filter((a) => needsReview(a.status)).length,
    "/admin/transport/vehicles": vehicles.filter((v) => needsReview(v.status)).length,
    "/admin/transport/manpower": workers.filter((m) => needsReview(m.status)).length,
    "/admin/listings": openListings(now).filter((l) => l.pendingSync).length,
  };

  return (
    <div className="flex min-h-svh w-full">
      <AdminNav pending={pending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConsoleTopBar
          session={{ email: session.email, role: session.claims.role }}
          // Only the admin shell offers these. The buying and farm shells hold
          // one account and have nobody to look into.
          consoles={CONSOLE_KINDS.map((kind) => ({
            kind,
            label: CONSOLES[kind].label,
            short: CONSOLES[kind].short,
          }))}
        />
        {children}
      </div>
    </div>
  );
}
