"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VerificationStatus } from "@/lib/domain/admin";

/**
 * A governed entity list.
 *
 * A thin specialisation of `DataTable` for anything with a verification
 * lifecycle — buyers, farmers, drivers, vehicles. It supplies the three
 * questions those records always raise (what is waiting, what is live, what is
 * stopped) and the approve/suspend actions. Everything else — search, sorting,
 * columns, pagination, the card toggle — comes from the shared table, so these
 * lists cannot drift from the rest of the app.
 */

interface HasStatus {
  readonly id: string;
  readonly status: VerificationStatus;
}

const VERIFICATION_TABS: readonly FilterTab<HasStatus>[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending", match: (r) => r.status === "pending" },
  { value: "verified", label: "Verified", match: (r) => r.status === "verified" },
  {
    value: "blocked",
    label: "Stopped",
    match: (r) => r.status === "suspended" || r.status === "rejected",
  },
];

export function EntityTable<T extends HasStatus>({
  rows,
  columns,
  searchText,
  searchPlaceholder,
  entityLabel,
  nameOf,
  card,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder: string;
  entityLabel: string;
  nameOf: (row: T) => string;
  card?: (row: T) => ReactNode;
}) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      searchText={searchText}
      searchPlaceholder={searchPlaceholder}
      entityLabel={entityLabel}
      card={card}
      tabs={VERIFICATION_TABS as readonly FilterTab<T>[]}
      rowActions={(row) => <RowActions name={nameOf(row)} status={row.status} />}
    />
  );
}

/**
 * Actions offered depend on where the record is in its lifecycle. A verified
 * account cannot be "approved" again, and a rejected one is reinstated rather
 * than approved — the wording matters because it is an audit trail.
 */
function RowActions({
  name,
  status,
}: {
  name: string;
  status: VerificationStatus;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toast.info(`Opening ${name}`)}>
          View details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toast.info(`Requested documents from ${name}`)}
        >
          Request documents
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {status === "pending" ? (
          <>
            <DropdownMenuItem onClick={() => toast.success(`${name} approved`)}>
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => toast.error(`${name} rejected`)}
            >
              Reject
            </DropdownMenuItem>
          </>
        ) : null}

        {status === "verified" ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => toast.warning(`${name} suspended`)}
          >
            Suspend
          </DropdownMenuItem>
        ) : null}

        {status === "suspended" || status === "rejected" ? (
          <DropdownMenuItem onClick={() => toast.success(`${name} reinstated`)}>
            Reinstate
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The four admin tables import `Column` from here; keep that working.
export type { Column };
