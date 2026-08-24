import type { Metadata } from "next";
import { connection } from "next/server";

import { BargainLog } from "@/components/account/bargain-log";
import { HistoryList } from "@/components/account/history-list";
import { HistoryTabs } from "@/components/account/history-tabs";
import { SalesAnalytics } from "@/components/farm/sales-analytics";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { newestFirst } from "@/lib/domain/audit";
import { salesFrom } from "@/lib/domain/farm-analytics";
import { readActorHistory, readSubjectHistory } from "@/lib/firebase/audit-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "History · Farmer" };

/**
 * Everything that has already happened, in one place.
 *
 * Three questions that were in three places: what did I sell and for how much
 * (settled bargains), what has this crop been worth over time (the price
 * chart, behind a rail item called Prices), and who changed what (the audit
 * trail). A farmer wanting any of them had to know which of the three to open.
 *
 * The price chart has left the rail entirely. It is a thing you consult, not a
 * place you work, and a top-level item promises a destination.
 */
export default async function FarmHistoryPage() {
  await connection();

  // Read once, not inside the render expression — relative times then match
  // either side of hydration.
  const now = new Date().getTime();

  const { farmer } = await requireFarmer();

  const [mine, aboutMe, { threads }] = await Promise.all([
    readActorHistory(farmer.id),
    readSubjectHistory(farmer.id),
    readNegotiations(negotiations(now)),
  ]);

  // Deduplicated: an action a farmer took on their own record appears in both.
  const seen = new Set<string>();
  const entries = newestFirst([...mine, ...aboutMe]).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });

  const sales = salesFrom(threads.filter((thread) => thread.farmerId === farmer.id));

  return (
    <>
      <PageHeader
        title="History"
        description="What you have sold, what it has been worth, and every change made to your account."
      />

      <div className="flex max-w-3xl flex-col gap-6 p-5">
        <HistoryTabs
          labels={{
            bargains: "Bargains",
            prices: "Prices",
            actions: "Changes",
          }}
          bargains={<BargainLog sales={sales} now={now} />}
          prices={<SalesAnalytics sales={sales} />}
          actions={
            <HistoryList
              entries={entries}
              now={now}
              emptyHint="Once you edit a listing or operations update your account, it will be recorded here."
            />
          }
        />
      </div>
    </>
  );
}
