import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { TickerSlot } from "@/components/market/ticker-slot";
import { ConsoleTopBar } from "@/components/console/top-bar";
import { CONSOLES, CONSOLE_KINDS } from "@/lib/domain/console-kinds";
import { requireConsole } from "@/lib/auth/require";
import { needsReview } from "@/lib/domain/admin";
import { readThreads } from "@/lib/firebase/chat-store";
import { readKycAccounts } from "@/lib/firebase/kyc-read";
import {
  readBuyerAccounts,
  readDrivers,
  readFarmerAccounts,
  readVehicles,
  readWorkers,
} from "@/lib/firebase/roster-read";
import { openListings } from "@/lib/mock/listings";

/**
 * The platform admin shell.
 *
 * Counts of what is waiting are computed here rather than per page, so the rail
 * shows the same queue depth from wherever you are standing. Once Firestore
 * lands these become aggregation reads, not a scan.
 *
 * Operations only.
 *
 * A franchise used to reach it too — a regional partner given the whole
 * console read-only, on the reasoning that they are an admin without the
 * ability to change anything. They are not. A franchise is a contracted
 * partner who runs an area, and the platform view showed them every farmer,
 * buyer and agency on the platform, including the ones in a neighbouring
 * partner's area and the ones they compete with for stock. "Read-only" limits
 * what they can change; it does not limit what they can learn.
 *
 * So the door is shut rather than narrowed. `requireConsole` sends a franchise
 * to their own console, which is where the work is.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Second argument: operations have their own front door at `/admin/login`,
  // so an expired session here returns to it rather than to the public sign-in
  // page on the marketing site.
  const session = await requireConsole(["admin"], "/admin/login");
  const now = new Date();

  // Decides what the rail offers and whether any row carries an action. The
  // buttons being absent is presentation; `requireRole("admin")` on every write
  // endpoint is what makes it a permission.
  const readOnly = session.claims.role !== "admin";

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
    chatThreads,
    buyers,
    farmers,
    drivers,
    vehicles,
    workers,
  ] = await Promise.all([
    readKycAccounts(),
    readThreads(),
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

  // Nobody has answered these, and the person who wrote them is waiting.
  const chatWaiting = chatThreads.filter((thread) => !thread.answeredAt).length;

  const pending = {
    "/admin/notifications": kycWaiting + chatWaiting,
    "/admin/chat": chatWaiting,
    "/admin/kyc": kycWaiting,
    "/admin/buyers": buyers.filter((a) => needsReview(a.status)).length,
    "/admin/farmers": farmers.filter((a) => needsReview(a.status)).length,
    "/admin/transport/drivers": drivers.filter((a) => needsReview(a.status))
      .length,
    "/admin/transport/vehicles": vehicles.filter((v) => needsReview(v.status))
      .length,
    "/admin/transport/manpower": workers.filter((m) => needsReview(m.status))
      .length,
    "/admin/listings": openListings(now).filter((l) => l.pendingSync).length,
  };

  return (
    <div className="flex min-h-svh w-full">
      <AdminNav
        pending={pending}
        role={session.claims.role}
        email={session.email}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConsoleTopBar
          session={{ email: session.email, role: session.claims.role }}
          /*
            Only the admin shell offers these, and within it only operations.
            The buying and farm shells hold one account and have nobody to look
            into; a franchise has plenty to look into and no business doing it,
            since a dossier is the KYC and subscription detail of one account
            gathered onto a single page.
          */
          consoles={
            readOnly
              ? undefined
              : CONSOLE_KINDS.map((kind) => ({
                  kind,
                  label: CONSOLES[kind].label,
                  short: CONSOLES[kind].short,
                }))
          }
        />
        {/* Operations watch every district, so this is the platform's default
          state rather than one of theirs — they have no district of their own. */}
        <TickerSlot />
        {children}
      </div>
    </div>
  );
}
