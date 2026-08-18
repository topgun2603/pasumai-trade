"use client";

import { BadgeCheckIcon, BellIcon, InboxIcon, UploadIcon } from "lucide-react";
import Link from "next/link";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { OpsKind } from "@/lib/domain/ops-feed";

/**
 * Everything waiting on operations, in one place.
 *
 * Deliberately not a bell with a dot on it. A bell says "something happened",
 * and something happening is not the same as something being yours: a check
 * approved this morning is an event and is not work, while an enquiry nobody
 * has answered for three weeks has stopped being an event and is the most
 * pressing thing on the platform.
 *
 * So this is a worklist, oldest first, overdue at the top. It is read from the
 * queues rather than written alongside them, which is why nothing can appear
 * here that has already been dealt with.
 */

export interface FeedRow {
  readonly id: string;
  readonly kind: OpsKind;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  /** Pre-formatted on the server so both renders agree. */
  readonly waitingLabel: string;
  /** Raw, so the column sorts by age rather than by wording. */
  readonly since: number;
  readonly overdue: boolean;
}

const KIND: Record<OpsKind, { label: string; Icon: typeof BellIcon }> = {
  enquiry: { label: "Enquiry", Icon: InboxIcon },
  kyc: { label: "KYC check", Icon: BadgeCheckIcon },
  reupload: { label: "Waiting on them", Icon: UploadIcon },
};

export function OpsFeed({ rows }: { rows: FeedRow[] }) {
  const columns: Column<FeedRow>[] = [
    {
      key: "kind",
      header: "What",
      sortValue: (row) => row.kind,
      cell: (row) => {
        const kind = KIND[row.kind];
        return (
          <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <kind.Icon className="size-3.5 shrink-0" />
            {kind.label}
          </span>
        );
      },
    },
    {
      key: "title",
      header: "Who",
      sortValue: (row) => row.title.toLowerCase(),
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{row.title}</span>
          <span className="text-muted-foreground text-xs">{row.detail}</span>
        </span>
      ),
    },
    {
      key: "waiting",
      header: "Waiting",
      sortValue: (row) => row.since,
      cell: (row) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-muted-foreground text-xs">{row.waitingLabel}</span>
          {/*
            Said in words, not only in colour. "Overdue" is the one thing on
            this row somebody must not miss, and a red tint is invisible to a
            reader who cannot see red and to one glancing past.
          */}
          {row.overdue ? (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              Overdue
            </Badge>
          ) : null}
        </span>
      ),
    },
  ];

  const tabs: FilterTab<FeedRow>[] = [
    { value: "all", label: "Everything" },
    { value: "overdue", label: "Overdue", match: (row) => row.overdue },
    { value: "enquiry", label: "Enquiries", match: (row) => row.kind === "enquiry" },
    { value: "kyc", label: "KYC", match: (row) => row.kind === "kyc" },
  ];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BellIcon}
        tone="done"
        title="Nothing is waiting on operations"
        description="Every enquiry has been called and every document checked. Anything new appears here as it arrives — oldest first, with the ones past their reply time marked overdue."
      />
    );
  }

  return (
    <DataTable
      rows={rows}
      columns={columns}
      tabs={tabs}
      entityLabel="items"
      searchPlaceholder="Name, account or district"
      searchText={(row) => `${row.title} ${row.detail} ${KIND[row.kind].label}`}
      rowActions={(row) => (
        <Button asChild size="sm" variant="outline">
          <Link href={row.href}>Open</Link>
        </Button>
      )}
      card={(row) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{row.title}</span>
            {row.overdue ? (
              <Badge variant="outline" className="border-destructive/40 text-destructive">
                Overdue
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">{row.detail}</p>
          <p className="text-faint text-xs">
            {KIND[row.kind].label} · {row.waitingLabel}
          </p>
        </div>
      )}
    />
  );
}
