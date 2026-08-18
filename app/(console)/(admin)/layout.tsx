import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireConsole } from "@/lib/auth/require";
import { needsReview } from "@/lib/domain/admin";
import { countWaiting } from "@/lib/firebase/enquiries";
import { readKycAccounts } from "@/lib/firebase/kyc-read";
import {
  buyerAccounts,
  driverAccounts,
  farmerAccounts,
  workers,
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

  /*
    Both counts the rail carries that mean somebody is waiting on us. Read
    together so the two badges cannot disagree about how much work there is.
  */
  const [enquiriesWaiting, kycAccounts] = await Promise.all([
    countWaiting(),
    readKycAccounts(),
  ]);

  const kycWaiting = kycAccounts.reduce(
    (total, account) =>
      total + account.checks.filter((check) => check.state === "review").length,
    0,
  );

  const pending = {
    /*
      The one real count in here. An enquiry is a person who was told they
      would be called and has not been, so this number is somebody waiting by a
      phone rather than a row in a table — which is why it is read from the
      database while the rest are still derived from samples.
    */
    "/admin/notifications": enquiriesWaiting + kycWaiting,
    "/admin/enquiries": enquiriesWaiting,
    "/admin/kyc": kycWaiting,
    "/admin/buyers": buyerAccounts(now).filter((a) => needsReview(a.status)).length,
    "/admin/farmers": farmerAccounts(now).filter((a) => needsReview(a.status)).length,
    "/admin/transport/drivers": driverAccounts(now).filter((a) => needsReview(a.status)).length,
    "/admin/transport/vehicles": vehicles(now).filter((v) => needsReview(v.status)).length,
    "/admin/transport/manpower": workers(now).filter((m) => needsReview(m.status))
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
