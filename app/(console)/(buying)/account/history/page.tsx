import type { Metadata } from "next";
import { connection } from "next/server";

import { HistoryList } from "@/components/account/history-list";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { newestFirst } from "@/lib/domain/audit";
import { readActorHistory, readSubjectHistory } from "@/lib/firebase/audit-read";

export const metadata: Metadata = { title: "History" };

export default async function BuyingHistoryPage() {
  await connection();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const accountId = session.claims.accountId ?? "";

  const [mine, aboutMe] = await Promise.all([
    readActorHistory(accountId),
    readSubjectHistory(accountId),
  ]);

  const seen = new Set<string>();
  const entries = newestFirst([...mine, ...aboutMe]).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });

  return (
    <>
      <PageHeader
        title="History"
        description="Every change to your account and your orders — what it was, what it became, and who made it."
      />
      <div className="flex max-w-3xl flex-col gap-6 p-5">
        <HistoryList
          entries={entries}
          now={Date.now()}
          emptyHint="Once you bargain, order, or operations update your account, it will be recorded here."
        />
      </div>
    </>
  );
}
