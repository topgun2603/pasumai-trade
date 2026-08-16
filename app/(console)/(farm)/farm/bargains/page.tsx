import { HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { BargainHistory } from "@/components/farm/bargain-history";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { isSettled } from "@/lib/domain/negotiation";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Sales history · Farmer" };

/**
 * Finished bargains, and only finished ones.
 *
 * Live bargaining moved to where the produce is: a listing carries its own
 * open threads and opens them in a panel beside it. This page is the record —
 * what sold, at what price, and what came to nothing.
 *
 * The split is not cosmetic. A live bargain is a decision with a clock on it
 * and a settled one is a receipt, and a farmer who has to scroll past three
 * months of sales to answer today's offer will miss the offer.
 */
export default async function FarmBargainsPage() {
  await connection();

  const { farmer } = await requireFarmer();
  const clock = new Date().getTime();

  const { threads } = await readNegotiations(negotiations(clock));

  // Terminal only. `isSettled` is the domain's own word for "nobody can speak
  // in this any more", so the two stay in step if a status is ever added.
  const history = threads
    .filter((t) => t.farmerId === farmer.id && isSettled(t))
    .sort((a, b) => (b.agreedAt ?? b.openedAt).getTime() - (a.agreedAt ?? a.openedAt).getTime());

  const sold = history.filter((t) => t.status === "agreed");

  return (
    <>
      <PageHeader
        title="Sales history"
        description="Bargains that finished. Live ones are on the produce they belong to."
        aside={
          <p className="text-faint text-xs">
            {sold.length} sold · {history.length} closed
          </p>
        }
      />

      <div className="flex flex-col gap-4 p-5">
        {history.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
            <HistoryIcon className="size-7" />
            <p className="max-w-sm text-sm">
              Nothing has finished yet. When a bargain is accepted or closed it moves here, with
              the price it settled at.
            </p>
          </div>
        ) : (
          <BargainHistory threads={history} />
        )}
      </div>
    </>
  );
}
