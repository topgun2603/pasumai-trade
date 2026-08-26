import type { Metadata } from "next";
import { connection } from "next/server";

import { BargainTranscript } from "@/components/account/bargain-transcript";
import { HistoryList } from "@/components/account/history-list";
import { HistoryTabs } from "@/components/account/history-tabs";
import { SalesAnalytics } from "@/components/farm/sales-analytics";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { newestFirst } from "@/lib/domain/audit";
import { salesFrom } from "@/lib/domain/farm-analytics";
import {
  readActorHistory,
  readPartyHistory,
  readSubjectHistory,
} from "@/lib/firebase/audit-read";
import { consoleLocale } from "@/lib/i18n/console";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "History" };

/**
 * The same three questions the farm console answers, from the buying side.
 *
 * What did I agree and with whom, what has it cost, and who changed what. The
 * components are the farmer's — a bargain is one record with two readers, and
 * a buyer reading it in a different shape from the farmer would be two
 * accounts of one conversation.
 */
export default async function BuyingHistoryPage() {
  await connection();

  // Read once, not inside the render expression — relative times then match
  // either side of hydration.
  const now = new Date().getTime();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const accountId = session.claims.accountId ?? "";

  // The buyer's own language. Without it the transcript fell back to English
  // for everybody, which is the farm console's bug seen from the other side.
  const locale = await consoleLocale();

  const [mine, aboutMe, alsoMine, { threads }, { vocabulary }] = await Promise.all([
    readActorHistory(accountId),
    readSubjectHistory(accountId),
    // Bargains. Their subject is the thread, so neither of the other two finds
    // them — see `parties` in lib/domain/audit.ts.
    readPartyHistory(accountId),
    readNegotiations(negotiations(now)),
    readBargainVocabulary(),
  ]);

  const seen = new Set<string>();
  const entries = newestFirst([...mine, ...aboutMe, ...alsoMine]).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });

  const ours = threads.filter((thread) => thread.buyerId === accountId);
  const closed = ours
    .filter((thread) => thread.status !== "open")
    .sort(
      (a, b) => (b.agreedAt ?? b.openedAt).getTime() - (a.agreedAt ?? a.openedAt).getTime(),
    );

  return (
    <>
      <PageHeader
        title="History"
        description="What you have agreed, what it has cost, and every change made to your account."
      />

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
                  viewer="buyer"
                  locale={locale}
                  vocabulary={vocabulary}
                  now={now}
                />
              ),
            },
            {
              /*
                "Spend", not "Revenue". The same settled rates seen from the
                other side of the table — money out rather than money in, and
                calling both by the farmer's word would be the kind of detail
                that makes a console feel like somebody else's.
              */
              value: "revenue",
              label: "Spend",
              content: <SalesAnalytics sales={salesFrom(ours)} />,
            },
            {
              value: "audits",
              label: "Audits",
              count: entries.length,
              content: (
                <HistoryList
                  entries={entries}
                  now={now}
                  emptyHint="Once you bargain, order, or operations update your account, it will be recorded here."
                />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
