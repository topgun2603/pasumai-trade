"use client";

import { CheckCircle2Icon, ClockIcon, TruckIcon, XCircleIcon } from "lucide-react";
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
import { DISPATCH_LABELS, type DispatchStatus } from "@/lib/domain/dispatch-request";
import { cn } from "@/lib/utils";

export interface AgencyOption {
  readonly id: string;
  readonly name: string;
  readonly town: string;
  readonly districts: readonly string[];
  /** Vehicles they have on the platform, as a rough sense of size. */
  readonly fleetSize: number;
}

export interface TransportState {
  readonly agencyName: string;
  readonly status: DispatchStatus;
  readonly reason?: string;
  readonly quantity?: number;
  readonly unit?: string;
}

/**
 * Arranging the lorry, once a price is settled.
 *
 * The farmer picks. A farmer knows which agency turns up and which one does
 * not, and allocating automatically would be the platform being confident
 * about something it cannot see. What the platform does is narrow the list to
 * agencies that can legally carry the load today and cover the district —
 * everything excluded is excluded for a reason the farmer could not act on.
 */
export function AssignTransport({
  negotiationId,
  produceName,
  load,
  agencies,
  transport,
  district,
}: {
  negotiationId: string;
  produceName: string;
  /**
   * What this vehicle is collecting, e.g. "150 kg".
   *
   * The agreed share, not the listed lot. A field sold to three buyers produces
   * three of these, three vehicles and three collections — the agency needs to
   * know which load it is being asked for.
   */
  load: string;
  agencies: AgencyOption[];
  transport: TransportState | null;
  district: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const arranged =
    transport && (transport.status === "requested" || transport.status === "accepted");

  async function send() {
    if (!chosen) return;
    setBusy(true);

    const response = await fetch(`/api/negotiations/${negotiationId}/transport`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agencyId: chosen }),
    }).catch(() => null);

    setBusy(false);
    const data = (await response?.json().catch(() => ({}))) as { error?: string };

    if (!response?.ok) {
      toast.error(data?.error ?? "Could not arrange that.");
      return;
    }

    setOpen(false);
    setChosen(null);
    toast.success("Transport requested", {
      description: "The agency will confirm. You will see it here when they do.",
    });
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    const response = await fetch(`/api/negotiations/${negotiationId}/transport`, {
      method: "DELETE",
    }).catch(() => null);
    setBusy(false);

    const data = (await response?.json().catch(() => ({}))) as { error?: string };
    if (!response?.ok) {
      toast.error(data?.error ?? "Could not cancel that.");
      return;
    }
    toast.success("Request withdrawn");
    router.refresh();
  }

  if (arranged) {
    const accepted = transport.status === "accepted";
    return (
      <span className="flex items-center gap-2">
        {/* The agency in the transport colour, with the confirmed/waiting state
            as a separate mark. Colour says who; the icon says how far along. */}
        <EntityTag kind="transport" name={transport.agencyName} compact />
        <Badge
          variant="outline"
          className={cn(
            "shrink-0",
            accepted
              ? "border-success/40 bg-success-soft text-success"
              : "border-warning/40 bg-warning-soft text-warning",
          )}
        >
          {accepted ? <CheckCircle2Icon className="size-3" /> : <ClockIcon className="size-3" />}
          {/* What this vehicle is for. A lot split between buyers has one of
              these per buyer, and they are only distinguishable by the load. */}
          {transport.quantity !== undefined ? (
            <span className="tabular">
              {transport.quantity} {transport.unit ?? ""}
            </span>
          ) : accepted ? (
            "Confirmed"
          ) : (
            "Waiting"
          )}
        </Badge>
        {!accepted ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={cancel}>
            Cancel
          </Button>
        ) : null}
      </span>
    );
  }

  return (
    <>
      <span className="flex items-center gap-2">
        {transport?.status === "declined" ? (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            <XCircleIcon className="size-3" />
            {transport.agencyName} declined
          </Badge>
        ) : null}
        <Button size="sm" onClick={() => setOpen(true)}>
          <TruckIcon className="size-3.5" />
          Arrange transport
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>
              Who is collecting {load} of {produceName.toLowerCase()}?
            </DialogTitle>
            <DialogDescription>
              Agencies covering {district} whose paperwork is in order today. This
              collection is for this sale only — a lot sold in parts is collected
              in parts.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
            {agencies.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No transport agency covers {district} yet. Operations can arrange one — the price
                you agreed still stands.
              </p>
            ) : (
              agencies.map((agency) => (
                <button
                  key={agency.id}
                  type="button"
                  onClick={() => setChosen(agency.id)}
                  aria-pressed={chosen === agency.id}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg border px-4 py-3 text-left transition-colors",
                    chosen === agency.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <span className="font-medium">{agency.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {agency.town} · {agency.fleetSize} vehicle
                    {agency.fleetSize === 1 ? "" : "s"} · covers{" "}
                    {agency.districts.slice(0, 3).join(", ")}
                    {agency.districts.length > 3 ? "…" : ""}
                  </span>
                </button>
              ))
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t px-5 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !chosen} onClick={send}>
              {busy ? "Requesting…" : "Request pickup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The label for a status, for callers rendering it outside this component. */
export function dispatchLabel(status: DispatchStatus): string {
  return DISPATCH_LABELS[status];
}
