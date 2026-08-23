"use client";

import { ClockIcon, MapPinIcon, PackageIcon, TruckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntityTag } from "@/components/entity-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRegistration } from "@/lib/domain/registration";
import { formatQuantity } from "@/lib/domain/quantity";
import { VEHICLE_TYPE_LABELS, type VehicleType } from "@/lib/domain/admin";
import { countdown } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Jobs going, and the button that takes one.
 *
 * This is the other half of calling a lorry: a farmer broadcasts, and every
 * owner whose vehicle could do it sees the same list. First to accept has it.
 *
 * Which means the interesting case is **losing**. Two drivers tap at the same
 * moment, one gets a 409, and that person has to be told plainly that somebody
 * else took it — not shown a spinner, and not left looking at a job that is
 * still on their screen. So a refusal refreshes the board as well as saying so.
 */

export interface OfferedJob {
  readonly id: string;
  readonly produceName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly farmerName: string;
  readonly village: string;
  readonly district: string;
  readonly wantedType: VehicleType | null;
  readonly expiresAt: string;
  /** This agency's vehicles that could actually take it. */
  readonly usable: Array<{ id: string; registration: string; type: VehicleType }>;
}

export function PickupBoard({ jobs, now }: { jobs: OfferedJob[]; now: number }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(job: OfferedJob) {
    const vehicleId = chosen[job.id] ?? job.usable[0]?.id;
    if (!vehicleId) return;

    setBusy(job.id);
    const response = await fetch(`/api/pickups/${job.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vehicleId }),
    }).catch(() => null);

    setBusy(null);
    const data = (await response?.json().catch(() => ({}))) as {
      error?: string;
      registration?: string;
    };

    if (!response?.ok) {
      // Losing the race is the ordinary outcome, not a fault. Say who won and
      // take the job off the board rather than leaving it there to be tapped
      // again.
      toast.error(data?.error ?? "Could not take that job.");
      router.refresh();
      return;
    }

    toast.success("Job accepted", {
      description: `${formatRegistration(data.registration ?? "")} is committed to this pickup.`,
    });
    router.refresh();
  }

  if (jobs.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
        <TruckIcon className="size-7" />
        <p className="max-w-sm text-sm">
          No loads going right now. When a farmer nearby calls for a vehicle your
          fleet can carry, it appears here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {jobs.map((job) => {
        const expires = new Date(job.expiresAt);
        const vehicleId = chosen[job.id] ?? job.usable[0]?.id;
        const canTake = job.usable.length > 0;

        return (
          <li
            key={job.id}
            className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium">
                  <PackageIcon className="text-muted-foreground size-4" />
                  {formatQuantity(job.quantity, job.unit)} of {job.produceName}
                </span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <EntityTag kind="farmer" name={job.farmerName} compact />
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="size-3" />
                    {job.village}, {job.district}
                  </span>
                </span>
              </div>

              <Badge
                variant="outline"
                className="border-warning/40 bg-warning-soft text-warning tabular gap-1"
              >
                <ClockIcon className="size-3" />
                {countdown(expires, now)}
              </Badge>
            </div>

            {job.wantedType ? (
              <p className="text-muted-foreground text-xs">
                The farmer asked for a {VEHICLE_TYPE_LABELS[job.wantedType].toLowerCase()}.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {job.usable.length > 1 ? (
                <Select
                  value={vehicleId}
                  onValueChange={(id) => setChosen((c) => ({ ...c, [job.id]: id }))}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {job.usable.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {formatRegistration(vehicle.registration)} ·{" "}
                        {VEHICLE_TYPE_LABELS[vehicle.type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : canTake ? (
                <span className="text-muted-foreground text-xs">
                  {formatRegistration(job.usable[0].registration)}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  Nothing in your fleet can carry this
                </span>
              )}

              <Button
                size="sm"
                disabled={!canTake || busy === job.id}
                onClick={() => accept(job)}
                className={cn(!canTake && "opacity-60")}
              >
                <TruckIcon className="size-3.5" />
                {busy === job.id ? "Taking…" : "Accept"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
