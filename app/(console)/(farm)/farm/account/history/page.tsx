import type { Metadata } from "next";
import { connection } from "next/server";

import { HistoryList } from "@/components/account/history-list";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { readActorHistory, readSubjectHistory } from "@/lib/firebase/audit-read";
import { newestFirst } from "@/lib/domain/audit";

export const metadata: Metadata = { title: "History · Farmer" };

/**
 * What has changed on this account, and what this account changed.
 *
 * Both, merged. A farmer asking "why does my listing say 300" needs the edit
 * whoever made it — their own, or operations acting on their behalf — and a
 * page showing only one of those would hide exactly the case worth auditing.
 */
export default async function FarmHistoryPage() {
  await connection();

  const { farmer } = await requireFarmer();

  const [mine, aboutMe] = await Promise.all([
    readActorHistory(farmer.id),
    readSubjectHistory(farmer.id),
  ]);

  // Deduplicated: an action a farmer took on their own record appears in both.
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
        description="Every change to your account and your listings — what it was, what it became, and who made it."
      />
      <div className="flex max-w-3xl flex-col gap-6 p-5">
        <HistoryList
          entries={entries}
          now={Date.now()}
          emptyHint="Once you edit a listing or operations update your account, it will be recorded here."
        />
      </div>
    </>
  );
}
