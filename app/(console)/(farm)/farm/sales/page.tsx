import { HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { BargainHistory } from "@/components/farm/bargain-history";
import type { NearbyType, PickupState } from "@/components/farm/call-vehicle";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { agreedQuantity } from "@/lib/domain/dispatch-request";
import { isPoint } from "@/lib/domain/distance";
import { isSettled } from "@/lib/domain/negotiation";
import { byType, nearbyVehicles } from "@/lib/domain/pickup-request";
import { DEFAULT_POLICY } from "@/lib/domain/policy";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { readAgencies } from "@/lib/firebase/agency-read";
import { candidates, readPickups } from "@/lib/firebase/pickup-read";
import { vehicles } from "@/lib/mock/admin";
import { GEOGRAPHY } from "@/lib/mock/locations";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Sales · Farmer" };

/**
 * Finished bargains, and the vehicle for each.
 *
 * Live bargaining is its own section next door. This page is the record — what
 * sold, at what price, and what came to nothing — plus the one thing a farmer
 * still has to do about a settled sale: get it collected.
 *
 * Transport is called, not chosen. The farmer sees what kinds of vehicle are
 * near them and asks for one; every suitable owner gets it and the first to
 * accept has the job. Picking a company from a list was the old flow, and it
 * made a farmer with produce cut and lying in the sun compare freight vendors.
 */
export default async function FarmSalesPage() {
  await connection();

  const { farmer } = await requireFarmer();
  const clock = new Date().getTime();
  const now = new Date(clock);

  const [{ threads }, pickups] = await Promise.all([
    readNegotiations(negotiations(clock)),
    readPickups(farmer.id),
  ]);

  // Terminal only. `isSettled` is the domain's own word for "nobody can speak
  // in this any more", so the two stay in step if a status is ever added.
  const history = threads
    .filter((t) => t.farmerId === farmer.id && isSettled(t))
    .sort((a, b) => (b.agreedAt ?? b.openedAt).getTime() - (a.agreedAt ?? a.openedAt).getTime());

  const sold = history.filter((t) => t.status === "agreed");

  /*
    Where the farm is, so "nearby" means something. The village is a place with
    a pin on it; a village nobody has pinned yields no distance at all, and the
    screen says "in your district" rather than inventing kilometres.
  */
  const village = GEOGRAPHY.places.find(
    (place) => place.name.toLowerCase() === farmer.village?.toLowerCase(),
  );
  const from = village && isPoint({ lat: village.lat, lng: village.lng })
    ? { lat: village.lat as number, lng: village.lng as number }
    : null;

  const fleet = candidates({
    vehicles: vehicles(now),
    // Registered agencies, not only the seeded ones — otherwise a farmer never
    // sees a vehicle from a firm that joined the platform this week.
    agencies: await readAgencies(now),
    places: GEOGRAPHY.places,
    now: clock,
  });

  /*
    Sized against the largest load still needing a vehicle, so the counts on
    screen are ones the farmer can actually use. Sizing against the smallest
    would promise lorries that cannot take the big lot; against nothing at all
    would list vehicles that fit none of it.
  */
  const needing = sold.filter((t) => !pickups[t.id] || pickups[t.id].status === "expired");
  const largest = Math.max(0, ...needing.map(agreedQuantity));

  const nearby: NearbyType[] = byType(
    nearbyVehicles(fleet, from, {
      quantityKg: largest,
      needsRefrigeration: false,
      district: farmer.district,
      roadFactorPercent: DEFAULT_POLICY.roadFactorPercent,
    }),
  );

  const state: Record<string, PickupState> = Object.fromEntries(
    Object.entries(pickups).map(([negotiationId, request]) => [
      negotiationId,
      {
        id: request.id,
        // A window that has closed is expired here, whether or not anything has
        // swept the document — the farmer must be able to ask again.
        status:
          request.status === "searching" && clock >= request.expiresAt.getTime()
            ? ("expired" as const)
            : request.status,
        registration: request.acceptedBy?.registration,
        agencyName: request.acceptedBy?.agencyName,
        expiresAt: request.expiresAt.toISOString(),
      },
    ]),
  );

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
            nearby={nearby}
            village={farmer.village ?? farmer.district}
            pickups={state}
          />
        )}
      </div>
    </>
  );
}
