import { HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { BargainHistory } from "@/components/farm/bargain-history";
import { PageHeader } from "@/components/page-header";
import type { AgencyOption, TransportState } from "@/components/farm/assign-transport";
import { requireFarmer } from "@/lib/auth/farm";
import { availableAgencies } from "@/lib/domain/dispatch-request";
import { isSettled } from "@/lib/domain/negotiation";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { readTransport } from "@/lib/firebase/transport-read";
import { agencies, vehicles } from "@/lib/mock/admin";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Sales · Farmer" };

/**
 * Finished bargains, and only finished ones.
 *
 * Live bargaining is its own section next door. This page is the record — what
 * sold, at what price, and what came to nothing.
 *
 * The split is not cosmetic. A live bargain is a decision with a clock on it
 * and a settled one is a receipt, and a farmer who has to scroll past three
 * months of sales to answer today's offer will miss the offer.
 */
export default async function FarmBargainsPage() {
  await connection();

  const { farmer } = await requireFarmer();
  const clock = new Date().getTime();

  const [{ threads }, transport] = await Promise.all([
    readNegotiations(negotiations(clock)),
    readTransport(),
  ]);

  /*
    Only agencies that could actually collect: contracted for transport, papers
    in date, and covering this farmer's district. Listing the rest greyed out
    would read as "the platform has no transport" to a farmer who cannot tell
    why they are unavailable.
  */
  const now = new Date(clock);
  const fleet = vehicles(now);
  const options: AgencyOption[] = availableAgencies(agencies(now), farmer.district, clock).map(
    (a) => ({
      id: a.id,
      name: a.name,
      town: a.town,
      districts: a.districts,
      fleetSize: fleet.filter((v) => v.agencyId === a.id).length,
    }),
  );

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
        description="Bargains that finished. Live ones are under Bargains."
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
          <BargainHistory
            threads={history}
            agencies={options}
            district={farmer.district}
            transport={transport as Record<string, TransportState>}
          />
        )}
      </div>
    </>
  );
}
