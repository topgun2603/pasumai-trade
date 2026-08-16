"use client";

import { CheckCircle2Icon, CircleSlashIcon, TimerOffIcon } from "lucide-react";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/domain/money";
import type { Negotiation, NegotiationStatus } from "@/lib/domain/negotiation";

/**
 * What finished, and for how much.
 *
 * Through the same grid as every other list, so search, sorting, the filter
 * tabs and the table/cards toggle behave the way they do everywhere else.
 *
 * The settled price is the column that matters. A farmer looks at this to
 * answer one question — what did grade A go for last time — and burying it
 * behind a click would make them open every row.
 */

const OUTCOME: Record<
  NegotiationStatus,
  { label: string; icon: typeof CheckCircle2Icon; className: string }
> = {
  agreed: {
    label: "Sold",
    icon: CheckCircle2Icon,
    className: "border-success/40 text-success",
  },
  withdrawn: {
    label: "Withdrawn",
    icon: CircleSlashIcon,
    className: "text-muted-foreground",
  },
  expired: { label: "Expired", icon: TimerOffIcon, className: "text-muted-foreground" },
  // Present for exhaustiveness; an open thread never reaches this page.
  open: { label: "Open", icon: TimerOffIcon, className: "text-muted-foreground" },
};

function rates(thread: Negotiation) {
  const bands = thread.agreedBands ?? [];
  if (bands.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {bands.map((b) => (
        <span key={b.grade} className="bg-secondary rounded px-1.5 py-0.5 text-xs">
          <span className="font-medium">{b.grade.toUpperCase()}</span>{" "}
          <span className="tabular-nums">
            {formatMoney({ minorUnits: b.ratePerUnit, currency: "INR" })}
          </span>
        </span>
      ))}
    </span>
  );
}

export function BargainHistory({ threads }: { threads: Negotiation[] }) {
  const columns: Column<Negotiation>[] = [
    {
      key: "produce",
      header: "Produce",
      sortValue: (t) => t.produceName,
      cell: (t) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{t.produceName}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {t.quantity} {t.unit}
          </span>
        </span>
      ),
    },
    { key: "buyer", header: "Buyer", sortValue: (t) => t.buyerName, cell: (t) => t.buyerName },
    {
      key: "outcome",
      header: "Outcome",
      sortValue: (t) => t.status,
      cell: (t) => {
        const o = OUTCOME[t.status];
        const Icon = o.icon;
        return (
          <Badge variant="outline" className={o.className}>
            <Icon className="size-3" />
            {o.label}
          </Badge>
        );
      },
    },
    {
      key: "rates",
      header: "Settled at",
      cell: (t) => rates(t) ?? <span className="text-faint text-xs">no price agreed</span>,
    },
    {
      key: "closed",
      header: "Closed",
      sortValue: (t) => (t.agreedAt ?? t.openedAt).getTime(),
      cell: (t) => (
        <span className="text-muted-foreground text-xs">
          {(t.agreedAt ?? t.openedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
  ];

  const tabs: FilterTab<Negotiation>[] = [
    { value: "all", label: "All" },
    { value: "sold", label: "Sold", match: (t) => t.status === "agreed" },
    {
      value: "unsold",
      label: "Did not sell",
      match: (t) => t.status === "withdrawn" || t.status === "expired",
    },
  ];

  const card = (t: Negotiation) => {
    const o = OUTCOME[t.status];
    const Icon = o.icon;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{t.produceName}</span>
          <Badge variant="outline" className={o.className}>
            <Icon className="size-3" />
            {o.label}
          </Badge>
        </div>
        <span className="text-muted-foreground text-sm">
          {t.buyerName} · {t.quantity} {t.unit}
        </span>
        {rates(t)}
        <span className="text-faint text-xs">
          {(t.agreedAt ?? t.openedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    );
  };

  return (
    <DataTable
      rows={threads}
      columns={columns}
      tabs={tabs}
      card={card}
      entityLabel="bargains"
      searchPlaceholder="Search by crop or buyer"
      searchText={(t) => `${t.produceName} ${t.buyerName} ${t.status}`}
    />
  );
}
