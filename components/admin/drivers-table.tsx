"use client";

import { TruckIcon } from "lucide-react";

import { ComplianceBadge, DocumentList, StatusBadge } from "@/components/admin/badges";
import {
  EntityPhoto,
  MissingPhotoNote,
} from "@/components/admin/entity-photo";
import { EntityTable, type Column } from "@/components/admin/entity-table";
import type { ComplianceDocument, DriverAccount } from "@/lib/domain/admin";
import { relativeTime } from "@/lib/format";

/** Earliest expiry in a document set, or +Infinity when nothing lapses. */
function soonestExpiry(documents: readonly ComplianceDocument[]): number {
  const dated = documents
    .map((d) => d.expiresAt?.getTime())
    .filter((t): t is number => t !== undefined);
  return dated.length > 0 ? Math.min(...dated) : Number.POSITIVE_INFINITY;
}

export function DriversTable({
  drivers,
  now,
  agencyNames,
}: {
  drivers: DriverAccount[];
  now: number;
  /** Agency id to name. Omitted by an agency's own console, where every
   *  row belongs to them and the column would say the same thing throughout. */
  agencyNames?: Record<string, string>;
}) {
  const columns: Column<DriverAccount>[] = [
    {
      key: "name",
      header: "Driver",
      className: "min-w-48",
      sortValue: (d) => d.name,
      cell: (d) => (
        <div className="flex items-center gap-2.5">
          <EntityPhoto
            name={d.name}
            seed={d.id}
            photoUrl={d.photoUrl}
            size="sm"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{d.name}</span>
            <span className="text-faint truncate text-xs">
              {d.id} · {d.mobile}
            </span>
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
                <span className="text-faint font-mono text-xs">{r.agencyId}</span>
              </span>
            ),
          },
        ]
      : []),
    {
      key: "district",
      header: "District",
      className: "min-w-32",
      sortValue: (d) => d.district,
      cell: (d) => <span className="text-muted-foreground text-sm">{d.district}</span>,
    },
    {
      key: "vehicle",
      header: "Assigned vehicle",
      className: "min-w-44",
      cell: (d) =>
        d.assignedVehicle ? (
          <span className="flex items-center gap-1.5 text-sm">
            <TruckIcon className="text-faint size-3.5 shrink-0" />
            <span className="font-mono">{d.assignedVehicle}</span>
          </span>
        ) : (
          <span className="text-faint text-sm">Unassigned</span>
        ),
    },
    {
      key: "trips",
      header: "Trips",
      className: "min-w-20 text-right tabular",
      sortValue: (d) => d.tripsCompleted,
      cell: (d) => d.tripsCompleted,
    },
    {
      key: "licence",
      header: "Licence",
      className: "min-w-44",
      // Soonest expiry first — the point of sorting this column is to find
      // who is about to become undispatchable.
      sortValue: (d) => soonestExpiry(d.documents),
      cell: (d) => <ComplianceBadge documents={d.documents} now={now} />,
    },
    {
      key: "documents",
      header: "Documents",
      className: "min-w-52",
      cell: (d) => <DocumentList documents={d.documents} now={now} />,
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-32",
      cell: (d) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={d.status} />
          <span className="text-faint text-xs">
            {relativeTime(d.registeredAt, now)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <EntityTable
      rows={drivers}
      columns={columns}
      entityLabel="drivers"
      searchPlaceholder="Name, mobile, district or vehicle"
      nameOf={(d) => d.name}
      searchText={(d) =>
        `${d.name} ${d.mobile} ${d.district} ${d.id} ${d.assignedVehicle ?? ""} ${agencyNames?.[d.agencyId] ?? ""}`
      }
      card={(d) => (
        <>
          <div className="flex items-start gap-3">
            <EntityPhoto name={d.name} seed={d.id} photoUrl={d.photoUrl} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{d.name}</span>
              <span className="text-faint text-xs">
                {d.id} · {d.district}
              </span>
              <MissingPhotoNote photoUrl={d.photoUrl} />
            </span>
            <StatusBadge status={d.status} />
          </div>

          <ComplianceBadge documents={d.documents} now={now} />

          <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-faint text-xs">Mobile</dt>
            <dt className="text-faint text-xs">Trips</dt>
            <dd className="truncate">{d.mobile}</dd>
            <dd className="tabular">{d.tripsCompleted}</dd>
          </dl>

          <p className="flex items-center gap-1.5 text-sm">
            <TruckIcon className="text-faint size-3.5 shrink-0" />
            {d.assignedVehicle ? (
              <span className="font-mono">{d.assignedVehicle}</span>
            ) : (
              <span className="text-faint">Unassigned</span>
            )}
          </p>

          <DocumentList documents={d.documents} now={now} />
        </>
      )}
    />
  );
}
