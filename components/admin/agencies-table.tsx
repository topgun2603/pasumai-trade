"use client";

import {
  ComplianceBadge,
  DocumentList,
  StatusBadge,
} from "@/components/admin/badges";
import { EntityPhoto } from "@/components/admin/entity-photo";
import { EntityTable, type Column } from "@/components/admin/entity-table";
import { Badge } from "@/components/ui/badge";
import {
  AGENCY_SERVICE_LABELS,
  agencyDispatchable,
  type Agency,
} from "@/lib/domain/admin";
import { relativeTime } from "@/lib/format";

/**
 * Contracted supplier companies.
 *
 * The counts column is what makes this page worth opening: an agency is not
 * interesting in itself, it is interesting for how many people and vehicles
 * sit behind it — and for the fact that its own lapsed GST grounds every one
 * of them at once.
 */
export function AgenciesTable({
  rows,
  now,
  readOnly = false,
}: {
  rows: Array<
    Agency & { workerCount: number; vehicleCount: number; driverCount: number }
  >;
  now: number;
  /** Hides every row action. A franchise reads these screens, nothing more. */
  readOnly?: boolean;
}) {
  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "name",
      header: "Agency",
      className: "min-w-56",
      sortValue: (a) => a.name,
      cell: (a) => (
        <div className="flex items-center gap-2.5">
          <EntityPhoto
            name={a.name}
            seed={a.id}
            photoUrl={a.photoUrl}
            size="sm"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{a.name}</span>
            <span className="text-faint truncate text-xs">
              {a.id} · {a.town}, {a.district}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "services",
      header: "Contracted for",
      className: "min-w-40",
      sortValue: (a) => a.services.join(","),
      cell: (a) => (
        <span className="flex flex-wrap gap-1">
          {a.services.map((s) => (
            <Badge key={s} variant="secondary">
              {AGENCY_SERVICE_LABELS[s]}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      className: "min-w-44",
      sortValue: (a) => a.contactName,
      cell: (a) => (
        <span className="flex flex-col leading-tight">
          <span>{a.contactName}</span>
          <span className="text-faint text-xs">{a.mobile}</span>
        </span>
      ),
    },
    {
      key: "registered_count",
      header: "Registered",
      className: "min-w-40",
      sortValue: (a) => a.workerCount + a.vehicleCount + a.driverCount,
      cell: (a) => (
        <span className="text-muted-foreground tabular flex flex-wrap gap-x-3 text-sm">
          {a.workerCount > 0 ? <span>{a.workerCount} crew</span> : null}
          {a.vehicleCount > 0 ? <span>{a.vehicleCount} vehicles</span> : null}
          {a.driverCount > 0 ? <span>{a.driverCount} drivers</span> : null}
          {a.workerCount + a.vehicleCount + a.driverCount === 0 ? (
            <span className="text-faint">Nothing yet</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "districts",
      header: "Serves",
      className: "min-w-44",
      sortValue: (a) => a.districts.length,
      cell: (a) => (
        <span className="text-muted-foreground text-sm">
          {a.districts.join(", ")}
        </span>
      ),
    },
    {
      key: "dispatchable",
      header: "Standing",
      className: "min-w-36",
      sortValue: (a) => (agencyDispatchable(a, now) ? 0 : 1),
      cell: (a) =>
        agencyDispatchable(a, now) ? (
          <Badge
            variant="outline"
            className="border-success/40 bg-success-soft text-success"
          >
            Good standing
          </Badge>
        ) : (
          // Everything the agency registered is grounded with it, which is the
          // fact worth surfacing here rather than on each individual record.
          <Badge
            variant="outline"
            className="border-destructive/40 bg-destructive-soft text-destructive"
          >
            All grounded
          </Badge>
        ),
    },
    {
      key: "status",
      header: "Verification",
      className: "min-w-32",
      sortValue: (a) => a.status,
      cell: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: "documents",
      header: "Documents",
      className: "min-w-36",
      cell: (a) => <ComplianceBadge documents={a.documents} now={now} />,
    },
    {
      key: "registered",
      header: "Since",
      className: "min-w-28",
      sortValue: (a) => a.registeredAt.getTime(),
      cell: (a) => (
        <span className="text-muted-foreground text-sm">
          {relativeTime(a.registeredAt, now)}
        </span>
      ),
    },
  ];

  return (
    <EntityTable
      readOnly={readOnly}
      kind="agencies"
      rows={rows}
      columns={columns}
      entityLabel="agencies"
      searchPlaceholder="Name, contact, town or district"
      nameOf={(a) => a.name}
      searchText={(a) =>
        `${a.name} ${a.id} ${a.contactName} ${a.mobile} ${a.email} ${a.town} ${a.district} ${a.districts.join(" ")}`
      }
      card={(a) => (
        <>
          <div className="flex items-start gap-3">
            <EntityPhoto name={a.name} seed={a.id} photoUrl={a.photoUrl} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{a.name}</span>
              <span className="text-faint truncate text-xs">
                {a.town}, {a.district}
              </span>
            </span>
            <StatusBadge status={a.status} />
          </div>

          <span className="flex flex-wrap gap-1">
            {a.services.map((s) => (
              <Badge key={s} variant="secondary">
                {AGENCY_SERVICE_LABELS[s]}
              </Badge>
            ))}
          </span>

          <span className="text-muted-foreground tabular text-sm">
            {a.workerCount} crew · {a.vehicleCount} vehicles · {a.driverCount}{" "}
            drivers
          </span>

          <DocumentList documents={a.documents} now={now} />
        </>
      )}
    />
  );
}
