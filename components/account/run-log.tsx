import { TruckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { VEHICLE_TYPE_LABELS } from "@/lib/domain/admin";
import type { PickupRequest } from "@/lib/domain/pickup-request";
import { formatQuantity } from "@/lib/domain/quantity";
import { formatRegistration } from "@/lib/domain/registration";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Every run an agency has taken, as a record rather than a job board.
 *
 * The same rows appear under Book Transport while they are live and claimable.
 * This is the other question about them — what have we actually carried, for
 * whom, from where — and it has no buttons, because a history somebody can act
 * on is a work queue wearing a different name.
 *
 * The lorry and the driver are named on each row. An owner reconciling a
 * week's diesel or a driver's pay is looking for which vehicle went where, and
 * a run without a registration on it cannot answer that.
 */

const STATUS: Record<string, { label: string; className: string }> = {
  collected: { label: "Collected", className: "border-success/40 bg-success-soft text-success" },
  accepted: { label: "On the way", className: "border-warning/40 bg-warning-soft text-warning" },
  cancelled: { label: "Cancelled", className: "border-border text-muted-foreground" },
  searching: { label: "Open", className: "border-border text-muted-foreground" },
};

export function RunLog({
  runs,
  now,
}: {
  runs: readonly PickupRequest[];
  /** From the server, so relative times agree either side of hydration. */
  now: number;
}) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={TruckIcon}
        tone="done"
        title="No runs yet"
        description="When you take a collection it appears here with the farm, the load and the lorry that went — so a week's work can be read back without opening each one."
      />
    );
  }

  return (
    <ol className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
      {runs.map((run) => {
        const status = STATUS[run.status] ?? STATUS.searching;
        const taken = run.acceptedBy;

        return (
          <li key={run.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                <span>
                  {run.produceName} · {formatQuantity(run.quantity, run.unit)}
                </span>
                {run.needsRefrigeration ? (
                  <span className="text-primary text-xs font-normal">· reefer</span>
                ) : null}
              </span>
              <Badge variant="outline" className={cn("shrink-0", status.className)}>
                {status.label}
              </Badge>
            </div>

            <span className="text-muted-foreground text-xs">
              {run.farmerName}
              {run.pickupVillage ? ` · ${run.pickupVillage}` : ""}
              {run.pickupDistrict ? `, ${run.pickupDistrict}` : ""}
            </span>

            {taken ? (
              <span className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="tabular font-medium">
                  {formatRegistration(taken.registration)}
                </span>
                <span>{VEHICLE_TYPE_LABELS[taken.vehicleType]}</span>
                {taken.driverName ? <span>· {taken.driverName}</span> : null}
                <time
                  dateTime={taken.acceptedAt.toISOString()}
                  title={taken.acceptedAt.toLocaleString("en-IN")}
                  className="text-faint"
                >
                  {relativeTime(taken.acceptedAt, now)}
                </time>
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
