"use client";

import Image from "next/image";

import { DocumentList, StatusBadge } from "@/components/admin/badges";
import {
  EntityPhoto,
  MissingPhotoNote,
} from "@/components/admin/entity-photo";
import { EntityTable, type Column } from "@/components/admin/entity-table";
import type { FarmerAccount } from "@/lib/domain/admin";
import { relativeTime } from "@/lib/format";

export function FarmersTable({
  accounts,
  now,
}: {
  accounts: FarmerAccount[];
  now: number;
}) {
  const columns: Column<FarmerAccount>[] = [
    {
      key: "name",
      header: "Farmer",
      className: "min-w-48",
      sortValue: (f) => f.name,
      cell: (f) => (
        <div className="flex items-center gap-2.5">
          <EntityPhoto
            name={f.name}
            seed={f.id}
            photoUrl={f.photoUrl}
            size="sm"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{f.name}</span>
            <span className="text-faint truncate text-xs">
              {f.id} · {f.mobile}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      className: "min-w-40",
      sortValue: (f) => `${f.district} ${f.village}`,
      cell: (f) => (
        <span className="flex flex-col leading-tight">
          <span className="text-sm">{f.village}</span>
          <span className="text-faint text-xs">{f.district}</span>
        </span>
      ),
    },
    {
      key: "registeredBy",
      header: "Onboarded by",
      className: "min-w-48",
      sortValue: (f) => f.registeredAt.getTime(),
      cell: (f) => (
        <span className="flex flex-col leading-tight">
          <span className="text-sm">{f.registeredBy}</span>
          <span className="text-faint text-xs">
            {relativeTime(f.registeredAt, now)}
          </span>
        </span>
      ),
    },
    {
      key: "bank",
      header: "Bank",
      className: "min-w-28",
      cell: (f) => (
        <span className="tabular text-muted-foreground font-mono text-sm">
          ····{f.bankAccountTail}
        </span>
      ),
    },
    {
      key: "activity",
      header: "Activity",
      className: "min-w-32",
      sortValue: (f) => f.completedOrders,
      cell: (f) => (
        <span className="flex flex-col leading-tight">
          <span className="tabular text-sm">{f.completedOrders} completed</span>
          <span className="text-faint tabular text-xs">
            {f.activeListings} listing{f.activeListings === 1 ? "" : "s"} open
          </span>
        </span>
      ),
    },
    {
      key: "documents",
      header: "Documents",
      className: "min-w-52",
      cell: (f) => <DocumentList documents={f.documents} now={now} />,
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-32",
      cell: (f) => <StatusBadge status={f.status} />,
    },
  ];

  return (
    <EntityTable
      rows={accounts}
      columns={columns}
      entityLabel="farmers"
      searchPlaceholder="Name, village, district or ID"
      nameOf={(f) => f.name}
      searchText={(f) =>
        `${f.name} ${f.mobile} ${f.village} ${f.district} ${f.id} ${f.registeredBy}`
      }
      card={(f) => (
        <>
          {/* The land photograph is the one image worth showing at size — it
              is what an operator checks the declared acreage against. */}
          {f.landPhotoUrl ? (
            <span className="bg-secondary relative -mx-4 -mt-4 mb-1 block h-28 overflow-hidden rounded-t-lg">
              <Image
                src={f.landPhotoUrl}
                alt={`Land registered to ${f.name}`}
                fill
                unoptimized
                sizes="(min-width: 1280px) 22rem, (min-width: 768px) 45vw, 90vw"
                className="object-cover"
              />
            </span>
          ) : null}

          <div className="flex items-start gap-3">
            <EntityPhoto name={f.name} seed={f.id} photoUrl={f.photoUrl} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{f.name}</span>
              <span className="text-faint text-xs">
                {f.id} · {f.village}, {f.district}
              </span>
              <MissingPhotoNote photoUrl={f.photoUrl} />
            </span>
            <StatusBadge status={f.status} />
          </div>

          <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-faint text-xs">Mobile</dt>
            <dt className="text-faint text-xs">Bank</dt>
            <dd className="truncate">{f.mobile}</dd>
            <dd className="font-mono">····{f.bankAccountTail}</dd>
            <dt className="text-faint pt-1 text-xs">Completed</dt>
            <dt className="text-faint pt-1 text-xs">Open listings</dt>
            <dd className="tabular">{f.completedOrders}</dd>
            <dd className="tabular">{f.activeListings}</dd>
          </dl>

          <DocumentList documents={f.documents} now={now} />

          <p className="text-faint text-xs">
            Onboarded by {f.registeredBy} · {relativeTime(f.registeredAt, now)}
          </p>
        </>
      )}
    />
  );
}
