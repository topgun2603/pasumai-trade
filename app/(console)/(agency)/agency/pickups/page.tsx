import type { Metadata } from "next";
import { connection } from "next/server";

import { PickupBoard, type OfferedJob } from "@/components/agency/pickup-board";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireConsole } from "@/lib/auth/require";
import { suitability } from "@/lib/domain/pickup-request";
import { candidates, readOpenPickups } from "@/lib/firebase/pickup-read";
import { readVehicles } from "@/lib/firebase/roster-read";
import { readAgencies } from "@/lib/firebase/agency-read";
import { GEOGRAPHY } from "@/lib/mock/locations";

export const metadata: Metadata = { title: "Loads going · Transport" };

/**
 * Loads a farmer is looking for a vehicle to carry.
 *
 * Every live request, not a queue addressed to this agency — that is the point
 * of the model. What is filtered is *suitability*: a job is shown with the
 * vehicles from this fleet that could actually take it, and one with none is
 * shown greyed rather than hidden, so an owner can see the work they are
 * missing for want of a bigger lorry.
 *
 * Expiry is read on each render rather than swept by a job. A request whose
 * window has closed simply stops being offered; nothing has to run for that to
 * be true.
 */
export default async function AgencyPickupsPage() {
  await connection();

  const session = await requireConsole(["transport", "admin"]);
  const now = new Date();
  const clock = now.getTime();

  const [open] = await Promise.all([readOpenPickups()]);

  const fleet = candidates({
    vehicles: await readVehicles(),
    agencies: await readAgencies(),
    places: GEOGRAPHY.places,
    now: clock,
  });

  // This account's own vehicles. Operations see everything, because they field
  // the call when a driver cannot work the app.
  const mine =
    session.claims.role === "admin"
      ? fleet
      : fleet.filter((vehicle) => vehicle.agencyId === session.claims.accountId);

  const jobs: OfferedJob[] = open
    // A request whose window has run out is not on offer, whatever the document
    // still says — the sweep that closes it may not have run.
    .filter((request) => clock < request.expiresAt.getTime())
    .map((request) => ({
      id: request.id,
      produceName: request.produceName,
      quantity: request.quantity,
      unit: request.unit,
      farmerName: request.farmerName,
      village: request.pickupVillage ?? "",
      district: request.pickupDistrict,
      wantedType: request.wantedType ?? null,
      expiresAt: request.expiresAt.toISOString(),
      usable: mine
        .filter(
          (vehicle) =>
            // `suitability` decides, including whether this agency covers the
            // pickup district. A second check on where the lorry is parked
            // would hide jobs the endpoint would happily accept.
            suitability(vehicle, {
              quantityKg: request.quantity,
              needsRefrigeration: request.needsRefrigeration,
              wantedType: request.wantedType,
              district: request.pickupDistrict,
            }).ok,
        )
        .map((vehicle) => ({
          id: vehicle.id,
          registration: vehicle.registration,
          type: vehicle.type,
        })),
    }));

  const takeable = jobs.filter((job) => job.usable.length > 0).length;

  return (
    <>
      <AdminPageHeader
        title="Loads going"
        description="Farmers looking for a vehicle. Any suitable owner can accept — the first to do so has the job."
      />

      <div className="flex flex-col gap-4 p-6">
        {jobs.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            {takeable} of {jobs.length} can be taken by your fleet.
          </p>
        ) : null}
        <PickupBoard jobs={jobs} now={clock} />
      </div>
    </>
  );
}
