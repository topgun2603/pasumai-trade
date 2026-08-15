import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireConsole } from "@/lib/auth/require";
import { needsReview } from "@/lib/domain/admin";
import {
  buyerAccounts,
  driverAccounts,
  farmerAccounts,
  manpowerAccounts,
  vehicles,
} from "@/lib/mock/admin";
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

  const pending = {
    "/admin/buyers": buyerAccounts(now).filter((a) => needsReview(a.status)).length,
    "/admin/farmers": farmerAccounts(now).filter((a) => needsReview(a.status)).length,
    "/admin/transport/drivers": driverAccounts(now).filter((a) => needsReview(a.status)).length,
    "/admin/transport/vehicles": vehicles(now).filter((v) => needsReview(v.status)).length,
    "/admin/transport/manpower": manpowerAccounts(now).filter((m) => needsReview(m.status))
      .length,
    "/admin/listings": openListings(now).filter((l) => l.pendingSync).length,
  };

  return (
    <div className="flex min-h-svh w-full">
      <AdminNav pending={pending} session={{ email: session.email, role: session.claims.role }} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
