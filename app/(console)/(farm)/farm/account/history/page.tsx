import type { Metadata } from "next";
import { connection } from "next/server";

import { BargainTranscript } from "@/components/account/bargain-transcript";
import { HistoryList } from "@/components/account/history-list";
import { HistoryTabs } from "@/components/account/history-tabs";
import { SalesAnalytics } from "@/components/farm/sales-analytics";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { consoleLocale } from "@/lib/i18n/console";
import { newestFirst } from "@/lib/domain/audit";
import { salesFrom } from "@/lib/domain/farm-analytics";
import { readActorHistory, readSubjectHistory } from "@/lib/firebase/audit-read";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
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

  const [mine, aboutMe, { threads }, { vocabulary }, locale] = await Promise.all([
    readActorHistory(farmer.id),
    readSubjectHistory(farmer.id),
    readNegotiations(negotiations(now)),
    // The same phrase list the live thread reads from, so a bargain settled
    // months ago still renders in whatever language it is opened in.
    readBargainVocabulary(),
    consoleLocale(),
  ]);

  // Deduplicated: an action a farmer took on their own record appears in both.
  const seen = new Set<string>();
  const entries = newestFirst([...mine, ...aboutMe]).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });

  const ours = threads.filter((thread) => thread.farmerId === farmer.id);
  const sales = salesFrom(ours);

  /*
    Finished only, newest first. A live bargain belongs under Bargains where it
    can still be answered; this page is the record of the ones that are over.
  */
  const closed = ours
    .filter((thread) => thread.status !== "open")
    .sort((a, b) => (b.agreedAt ?? b.openedAt).getTime() - (a.agreedAt ?? a.openedAt).getTime());

  return (
    <>
      <PageHeader
        title="History"
        description="What you have sold, what it has been worth, and every change made to your account."
      />

      {/* Full width. A transcript is a conversation with rates beside it, and
        a three-quarter column wrapped every second line. */}
      <div className="flex flex-col gap-6 p-5">
        <HistoryTabs
          panels={[
            {
              value: "bargains",
              label: "Bargains",
              count: closed.length,
              content: (
                <BargainTranscript
                  threads={closed}
                  viewer="farmer"
                  vocabulary={vocabulary}
                  locale={locale}
                  now={now}
                />
              ),
            },
            {
              /*
                "Revenue", not "Prices". The tab holds what the crop earned,
                which is the question; a price is one figure inside the answer.
              */
              value: "revenue",
              label: "Revenue",
              content: <SalesAnalytics sales={sales} />,
            },
            {
              value: "audits",
              label: "Audits",
              count: entries.length,
              content: (
                <HistoryList
                  entries={entries}
                  now={now}
                  emptyHint="Once you edit a listing or operations update your account, it will be recorded here."
                />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
