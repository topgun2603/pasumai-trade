import type { Metadata } from "next";
import { connection } from "next/server";

import { HistoryList } from "@/components/account/history-list";
import { HistoryTabs } from "@/components/account/history-tabs";
import { RunLog } from "@/components/account/run-log";
import { PageHeader } from "@/components/page-header";
import { requireAgency } from "@/lib/auth/agency";
import { newestFirst } from "@/lib/domain/audit";
import {
  readActorHistory,
  readPartyHistory,
  readSubjectHistory,
} from "@/lib/firebase/audit-read";
import { readAgencyPickups } from "@/lib/firebase/pickup-read";

export const metadata: Metadata = { title: "History · Agency" };

/**
 * What this agency has carried, and what has changed about it.
 *
 * Two tabs rather than the farm console's three, and the missing one is
 * deliberate: an agency's earnings are not recorded anywhere. A claimed
 * pickup carries the vehicle, the driver and the time, and no amount — so an
 * Earnings tab would be an empty panel implying the platform knows something
 * it does not. It arrives when a run carries a rate.
 */
export default async function AgencyHistoryPage() {
  await connection();

  // Read once, not inside the render expression.
  const now = new Date().getTime();

  const { agency } = await requireAgency();

  const [mine, aboutMe, alsoMine, runs] = await Promise.all([
    readActorHistory(agency.id),
    readSubjectHistory(agency.id),
    readPartyHistory(agency.id),
    readAgencyPickups(agency.id),
  ]);

  const seen = new Set<string>();
  const entries = newestFirst([...mine, ...aboutMe, ...alsoMine]).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });

  return (
    <>
      <PageHeader
        title="History"
        description="Every collection you have taken, and every change made to your agency."
      />

      <div className="flex flex-col gap-6 p-5">
        <HistoryTabs
          panels={[
            {
              value: "runs",
              label: "Runs",
              count: runs.length,
              content: <RunLog runs={runs} now={now} />,
            },
            {
              value: "audits",
              label: "Audits",
              count: entries.length,
              content: (
                <HistoryList
                  entries={entries}
                  now={now}
                  emptyHint="Once you file a vehicle or crew member, or operations verify your agency, it will be recorded here."
                />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
