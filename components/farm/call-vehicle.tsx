"use client";

import {
  CheckCircle2Icon,
  ClockIcon,
  MapPinIcon,
  TruckIcon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntityTag } from "@/components/entity-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VEHICLE_TYPE_LABELS, type VehicleType } from "@/lib/domain/admin";
import { cn } from "@/lib/utils";

/**
 * Calling a lorry, the way anybody calls one.
 *
 * The farmer sees what is actually near them, grouped by the only thing they
 * have an opinion about — how big a vehicle. They pick a type, or take
 * whatever is closest, and the request goes to every suitable vehicle at once.
 * Whoever accepts first has the job.
 *
 * Nobody chooses a company here. A farmer with produce cut and lying in the sun
 * does not want to compare transport agencies; they want to know a vehicle is
 * coming and roughly when.
 */

export interface NearbyType {
  readonly type: VehicleType;
  readonly count: number;
  /** Null where nobody has pinned the vehicles' base. Shown as such. */
  readonly nearestKm: number | null;
}

export interface PickupState {
  readonly id: string;
  readonly status: "searching" | "accepted" | "cancelled" | "expired";
  readonly registration?: string;
  readonly agencyName?: string;
  readonly expiresAt?: string;
}

export function CallVehicle({
  negotiationId,
  produceName,
  load,
  nearby,
  pickup,
  village,
}: {
  negotiationId: string;
  produceName: string;
  /** What is being collected, e.g. "150 kg". The agreed share. */
  load: string;
  /** What is about, by type. Empty means nothing suitable is in range. */
  nearby: NearbyType[];
  /** The request already out for this load, if there is one. */
  pickup: PickupState | null;
  village: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState<VehicleType | null>(null);
  const [busy, setBusy] = useState(false);

  const total = nearby.reduce((sum, group) => sum + group.count, 0);

  async function send() {
    setBusy(true);
    const response = await fetch("/api/pickups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ negotiationId, vehicleType: wanted ?? undefined }),
    }).catch(() => null);

    setBusy(false);
    const data = (await response?.json().catch(() => ({}))) as { error?: string };

    if (!response?.ok) {
      toast.error(data?.error ?? "Could not send that request.");
      return;
    }

    setOpen(false);
    toast.success("Looking for a vehicle", {
      description: "Every suitable driver nearby has it. The first to accept takes the job.",
    });
    router.refresh();
  }

  async function callOff() {
    if (!pickup) return;
    setBusy(true);
    const response = await fetch(`/api/pickups/${pickup.id}`, { method: "DELETE" }).catch(
      () => null,
    );
    setBusy(false);

    const data = (await response?.json().catch(() => ({}))) as { error?: string };
    if (!response?.ok) {
      toast.error(data?.error ?? "Could not call that off.");
      return;
    }
    toast.success("Search called off");
    router.refresh();
  }

  /* A vehicle is coming ---------------------------------------------------- */

  if (pickup?.status === "accepted") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <EntityTag kind="transport" name={pickup.agencyName ?? "Agency"} compact />
        <Badge
          variant="outline"
          className="border-success/40 bg-success-soft text-success gap-1"
        >
          <CheckCircle2Icon className="size-3" />
          {pickup.registration ?? "Confirmed"}
        </Badge>
      </span>
    );
  }

  /* Still looking ---------------------------------------------------------- */

  if (pickup?.status === "searching") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-warning/40 bg-warning-soft text-warning gap-1"
        >
          {/* Deliberately not a spinner pretending to be progress. Nothing is
              happening here except waiting for somebody to look at a phone. */}
          <ClockIcon className="size-3" />
          Looking for a vehicle
        </Badge>
        <Button size="sm" variant="outline" disabled={busy} onClick={callOff}>
          Call off
        </Button>
      </span>
    );
  }

  /* Nothing out ------------------------------------------------------------ */

  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        {pickup?.status === "expired" ? (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <XCircleIcon className="size-3" />
            Nobody answered
          </Badge>
        ) : null}
        <Button size="sm" onClick={() => setOpen(true)} disabled={total === 0}>
          <TruckIcon className="size-3.5" />
          {total === 0 ? "No vehicles nearby" : `Call a vehicle (${total})`}
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Call a vehicle for {load}</DialogTitle>
            <DialogDescription>
              {produceName}, from {village}. Every suitable driver nearby gets the
              request — the first to accept takes it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
            {/*
              "Any" first and selected by default. Naming a type narrows the
              broadcast, which is a real cost — a farmer who insists on a tempo
              waits longer than one who takes whatever fits.
            */}
            <button
              type="button"
              onClick={() => setWanted(null)}
              aria-pressed={wanted === null}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                wanted === null ? "border-primary bg-accent" : "border-border hover:bg-secondary",
              )}
            >
              <span className="flex flex-col">
                <span className="font-medium">Any vehicle that fits</span>
                <span className="text-muted-foreground text-xs">
                  Reaches the most drivers, so it is answered soonest
                </span>
              </span>
              <Badge variant="secondary" className="tabular shrink-0">
                {total}
              </Badge>
            </button>

            {nearby.map((group) => (
              <button
                key={group.type}
                type="button"
                onClick={() => setWanted(group.type)}
                aria-pressed={wanted === group.type}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  wanted === group.type
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-secondary",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{VEHICLE_TYPE_LABELS[group.type]}</span>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <MapPinIcon className="size-3" />
                    {/* No distance is said as no distance. A number invented for
                        a vehicle nobody has pinned would look exactly like a
                        real one. */}
                    {group.nearestKm === null
                      ? "in your district"
                      : `nearest about ${group.nearestKm} km`}
                  </span>
                </span>
                <Badge variant="secondary" className="tabular shrink-0">
                  {group.count}
                </Badge>
              </button>
            ))}

            {nearby.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No vehicle nearby can take {load} today. Operations can arrange one —
                the price you agreed still stands.
              </p>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t px-5 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || total === 0} onClick={send}>
              <TruckIcon className="size-4" />
              {busy ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
