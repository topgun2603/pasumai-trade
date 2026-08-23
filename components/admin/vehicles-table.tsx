"use client";

import { SnowflakeIcon, TruckIcon } from "lucide-react";
import Image from "next/image";

import {
  ComplianceBadge,
  DocumentList,
  StatusBadge,
} from "@/components/admin/badges";
import { EntityPhoto } from "@/components/admin/entity-photo";
import { EntityTable, type Column } from "@/components/admin/entity-table";
import { Badge } from "@/components/ui/badge";
import {
  VEHICLE_TYPE_LABELS,
  type ComplianceDocument,
  type Vehicle,
} from "@/lib/domain/admin";
import { formatQuantity, relativeTime } from "@/lib/format";

/** Earliest expiry in a document set, or +Infinity when nothing lapses. */
function soonestExpiry(documents: readonly ComplianceDocument[]): number {
  const dated = documents
    .map((d) => d.expiresAt?.getTime())
    .filter((t): t is number => t !== undefined);
  return dated.length > 0 ? Math.min(...dated) : Number.POSITIVE_INFINITY;
}

export function VehiclesTable({
  fleet,
  now,
  agencyNames,
}: {
  fleet: Vehicle[];
  now: number;
  /** Agency id to name. Omitted by an agency's own console, where every
   *  row belongs to them and the column would say the same thing throughout. */
  agencyNames?: Record<string, string>;
}) {
  const columns: Column<Vehicle>[] = [
    {
      key: "registration",
      header: "Registration",
      className: "min-w-44",
      sortValue: (v) => v.registration,
      cell: (v) => (
        <div className="flex items-center gap-2.5">
          <EntityPhoto
            name={v.registration}
            seed={v.id}
            photoUrl={v.photoUrl}
            size="sm"
            icon={TruckIcon}
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-mono font-medium">
              {v.registration}
            </span>
            <span className="text-faint text-xs">{v.id}</span>
          </span>
        </div>
      ),
    },
    ...(agencyNames
      ? [
          {
            key: "agency",
            header: "Agency",
            className: "min-w-40",
            sortValue: (r: { agencyId: string }) =>
              agencyNames[r.agencyId] ?? r.agencyId,
            cell: (r: { agencyId: string }) => (
              <span className="flex flex-col leading-tight">
                <span className="truncate text-sm">
                  {agencyNames[r.agencyId] ?? "Unknown agency"}
                </span>
                <span className="text-faint font-mono text-xs">
                  {r.agencyId}
                </span>
              </span>
            ),
          },
        ]
      : []),
    {
      key: "type",
      header: "Type",
      className: "min-w-40",
      cell: (v) => (
        <span className="flex items-center gap-1.5">
          <Badge variant="secondary">{VEHICLE_TYPE_LABELS[v.type]}</Badge>
          {v.refrigerated ? (
            <Badge
              variant="outline"
              className="border-success/40 bg-success-soft text-success gap-1"
            >
              <SnowflakeIcon className="size-3" />
              Reefer
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "capacity",
      header: "Capacity",
      className: "min-w-24 text-right tabular",
      sortValue: (v) => v.capacityKg,
      cell: (v) => (
        <span className="text-sm">{formatQuantity(v.capacityKg)} kg</span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      className: "min-w-48",
      sortValue: (v) => v.owner,
      cell: (v) => (
        <span className="flex flex-col leading-tight">
          <span className="text-sm">{v.owner}</span>
          <span className="text-faint text-xs">{v.district}</span>
        </span>
      ),
    },
    {
      key: "driver",
      header: "Driver",
      className: "min-w-36",
      cell: (v) =>
        v.assignedDriver ? (
          <span className="text-sm">{v.assignedDriver}</span>
        ) : (
          <span className="text-faint text-sm">Unassigned</span>
        ),
    },
    {
      key: "compliance",
      header: "Compliance",
      className: "min-w-44",
      // Soonest expiry first, so the fleet about to go off the road sorts to
      // the top.
      sortValue: (v) => soonestExpiry(v.documents),
      cell: (v) => <ComplianceBadge documents={v.documents} now={now} />,
    },
    {
      key: "documents",
      header: "Documents",
      className: "min-w-64",
      cell: (v) => <DocumentList documents={v.documents} now={now} />,
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-32",
      cell: (v) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={v.status} />
          <span className="text-faint text-xs">
            {relativeTime(v.registeredAt, now)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <EntityTable
      kind="vehicles"
      rows={fleet}
      columns={columns}
      entityLabel="vehicles"
      searchPlaceholder="Registration, owner or driver"
      nameOf={(v) => v.registration}
      searchText={(v) =>
        `${v.registration} ${v.owner} ${v.district} ${v.assignedDriver ?? ""} ${v.id} ${agencyNames?.[v.agencyId] ?? ""}`
      }
      card={(v) => (
        <>
          {v.photoUrl ? (
            <span className="bg-secondary relative -mx-4 -mt-4 mb-1 block h-32 overflow-hidden rounded-t-lg">
              <Image
                src={v.photoUrl}
                alt={`Vehicle ${v.registration}`}
                fill
                unoptimized
                sizes="(min-width: 1280px) 22rem, (min-width: 768px) 45vw, 90vw"
                className="object-cover"
              />
            </span>
          ) : (
            <span className="bg-secondary text-faint -mx-4 -mt-4 mb-1 flex h-32 items-center justify-center rounded-t-lg border-b border-dashed">
              <span className="flex flex-col items-center gap-1">
                <TruckIcon className="size-6" />
                <span className="text-xs">No photo on file</span>
              </span>
            </span>
          )}

          <div className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-mono font-medium">
                {v.registration}
              </span>
              <span className="text-faint text-xs">
                {v.id} · {v.district}
              </span>
            </span>
            <StatusBadge status={v.status} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{VEHICLE_TYPE_LABELS[v.type]}</Badge>
            {v.refrigerated ? (
              <Badge
                variant="outline"
                className="border-success/40 bg-success-soft text-success gap-1"
              >
                <SnowflakeIcon className="size-3" />
                Reefer
              </Badge>
            ) : null}
            <ComplianceBadge documents={v.documents} now={now} />
          </div>

          <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-faint text-xs">Capacity</dt>
            <dt className="text-faint text-xs">Driver</dt>
            <dd className="tabular">{formatQuantity(v.capacityKg)} kg</dd>
            <dd className="truncate">
              {v.assignedDriver ?? (
                <span className="text-faint">Unassigned</span>
              )}
            </dd>
          </dl>

          <DocumentList documents={v.documents} now={now} />

          <p className="text-faint text-xs">Owned by {v.owner}</p>
        </>
      )}
    />
  );
}
