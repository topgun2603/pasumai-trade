"use client";

import { UsersIcon } from "lucide-react";
import Link from "next/link";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConsoleKind } from "@/lib/domain/console-kinds";

/**
 * Every account of one kind, to find one by.
 *
 * Search is the point of the page. An operator arrives here from a telephone
 * call holding one of three things — a name, an account id, or a mobile number
 * — and rarely the same one twice, so all three match. The number is included
 * even though it is not a column: it is the thing a caller reads out.
 */

export interface DirectoryRow {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly mobile?: string;
  readonly where: string;
  readonly status: string;
  readonly planLabel?: string;
  readonly planStatus?: string;
  readonly joinedLabel: string;
  readonly joinedAt: number;
}

const STATUS_STYLE: Record<string, string> = {
  verified: "border-success/40 text-success",
  pending: "border-warning/40 bg-warning-soft text-warning",
  rejected: "border-destructive/40 text-destructive",
  suspended: "border-destructive/40 text-destructive",
};

export function AccountDirectory({
  rows,
  kind,
  one,
}: {
  rows: DirectoryRow[];
  kind: ConsoleKind;
  /** Singular label, for the empty state. */
  one: string;
}) {
  const columns: Column<DirectoryRow>[] = [
    {
      key: "name",
      header: "Account",
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted-foreground text-xs">
            <span className="font-mono">{row.accountId}</span>
            {row.mobile ? ` · ${row.mobile}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "where",
      header: "Where",
      sortValue: (row) => row.where.toLowerCase(),
      cell: (row) => <span className="text-muted-foreground text-sm">{row.where || "—"}</span>,
    },
    {
      key: "status",
      header: "Account",
      sortValue: (row) => row.status,
      cell: (row) => (
        <Badge variant="outline" className={STATUS_STYLE[row.status] ?? ""}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sortValue: (row) => row.planLabel ?? "",
      cell: (row) =>
        row.planLabel ? (
          <span className="flex flex-col leading-tight">
            <span className="text-sm">{row.planLabel}</span>
            <span className="text-faint text-xs">{row.planStatus}</span>
          </span>
        ) : (
          <span className="text-faint text-sm">No plan</span>
        ),
    },
    {
      key: "joined",
      header: "Joined",
      // The stamp, not the wording: "3 days ago" sorts alphabetically.
      sortValue: (row) => row.joinedAt,
      cell: (row) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">{row.joinedLabel}</span>
      ),
    },
  ];

  const tabs: FilterTab<DirectoryRow>[] = [
    { value: "all", label: "All" },
    { value: "verified", label: "Verified", match: (row) => row.status === "verified" },
    { value: "waiting", label: "Not verified", match: (row) => row.status === "pending" },
    { value: "paying", label: "Paying", match: (row) => row.planStatus === "active" },
    { value: "stopped", label: "Stopped", match: (row) => row.status === "suspended" || row.status === "rejected" },
  ];

  const open = (row: DirectoryRow) => (
    <Button asChild size="sm" variant="outline">
      <Link href={`/admin/consoles/${kind}/${row.accountId}`}>Open</Link>
    </Button>
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      tabs={tabs}
      entityLabel="accounts"
      searchPlaceholder="Name, account id or mobile number"
      // The mobile number is searchable without being a column: it is what a
      // caller reads out, and what an operator has in front of them.
      searchText={(row) => `${row.name} ${row.accountId} ${row.mobile ?? ""} ${row.where}`}
      rowActions={open}
      empty={{
        icon: UsersIcon,
        title: `No ${one.toLowerCase()} accounts yet`,
        description:
          "Accounts appear here as soon as they register. Open one to see everything the platform knows about it.",
      }}
      card={(row) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{row.name}</span>
            <Badge variant="outline" className={STATUS_STYLE[row.status] ?? ""}>
              {row.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs">
            <span className="font-mono">{row.accountId}</span>
            {row.mobile ? ` · ${row.mobile}` : ""}
          </p>
          <p className="text-faint text-xs">
            {row.where || "Location not recorded"} · {row.planLabel ?? "No plan"}
          </p>
        </div>
      )}
    />
  );
}
