"use client";

import { BanknoteIcon, CheckIcon, ClockIcon, InfinityIcon, XIcon } from "lucide-react";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CHANNEL_LABELS, type Channel, type ReminderStage } from "@/lib/domain/subscription-reminder";

/**
 * Who is paying, on what, and when it runs out.
 *
 * None of this was visible anywhere. Operations could not answer "who is paying
 * us", could not chase a renewal, and could not tell somebody locked out this
 * morning why — the only way to look was to open Firestore.
 *
 * Sorted so the thing that costs money comes first: what lapses soonest.
 */

export interface SubscriptionRow {
  readonly id: string;
  readonly accountId: string;
  readonly kind: string;
  readonly name: string;
  readonly termLabel: string;
  readonly status: string;
  readonly amountLabel?: string;
  /** Pre-formatted on the server so both renders agree. */
  readonly renewsLabel: string;
  /** Raw, so the column sorts by date rather than by wording. */
  readonly renewsAt: number;
  readonly daysLeft: number | null;
  readonly lifetime: boolean;
  readonly remindersSent: readonly ReminderStage[];
  readonly reachable: readonly Channel[];
}

const STATUS_STYLE: Record<string, string> = {
  active: "border-success/40 text-success",
  trialing: "border-primary/40 text-primary",
  pastDue: "border-warning/40 bg-warning-soft text-warning",
  expired: "border-destructive/40 text-destructive",
  cancelled: "text-muted-foreground",
  requested: "border-warning/40 bg-warning-soft text-warning",
};

export function SubscriptionsTable({ rows }: { rows: SubscriptionRow[] }) {
  const columns: Column<SubscriptionRow>[] = [
    {
      key: "name",
      header: "Account",
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted-foreground text-xs">
            <span className="font-mono">{row.accountId}</span> · {row.kind}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Paid",
      sortValue: (row) => row.amountLabel ?? "",
      cell: (row) => (
        <span className="text-muted-foreground tabular text-sm">{row.amountLabel ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => (
        <Badge variant="outline" className={STATUS_STYLE[row.status] ?? ""}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "renews",
      header: "Runs out",
      // The date, not the wording: "in 3 days" and "lapsed" sort into nonsense.
      sortValue: (row) => row.renewsAt,
      cell: (row) =>
        row.lifetime ? (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm whitespace-nowrap">
            <InfinityIcon className="size-3.5" />
            Never
          </span>
        ) : (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm">{row.renewsLabel}</span>
            {row.daysLeft !== null && row.daysLeft <= 7 ? (
              <Badge
                variant="outline"
                className={
                  row.daysLeft < 0
                    ? "border-destructive/40 text-destructive"
                    : "border-warning/40 bg-warning-soft text-warning"
                }
              >
                {row.daysLeft < 0 ? "Lapsed" : "Ending"}
              </Badge>
            ) : null}
          </span>
        ),
    },
    {
      key: "reminders",
      header: "Reminded",
      sortValue: (row) => row.remindersSent.length,
      cell: (row) =>
        row.lifetime ? (
          <span className="text-faint text-xs">Not applicable</span>
        ) : row.remindersSent.length === 0 ? (
          <span className="text-faint text-xs">Not yet</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.remindersSent.map((stage) => (
              <Badge key={stage} variant="outline" className="text-[10px]">
                <CheckIcon className="size-3" />
                {stage}
              </Badge>
            ))}
          </span>
        ),
    },
  ];

  const tabs: FilterTab<SubscriptionRow>[] = [
    { value: "all", label: "All" },
    {
      value: "ending",
      label: "Ending soon",
      match: (row) => !row.lifetime && row.daysLeft !== null && row.daysLeft >= 0 && row.daysLeft <= 14,
    },
    {
      value: "lapsed",
      label: "Lapsed",
      match: (row) => !row.lifetime && row.daysLeft !== null && row.daysLeft < 0,
    },
    { value: "lifetime", label: "Lifetime", match: (row) => row.lifetime },
  ];

  /*
    A table per plan rather than one list with a plan column.

    The question operations actually ask is per plan — how many are on the
    six-month term, how many lifetime, which of the monthly ones lapse this
    week. A single sortable column makes that a re-sort every time, and the
    counts have to be worked out by eye. Each section carries its own search
    and paging, so reading the monthly plans does not move the page you are on
    for the annual ones.

    Ordered by how many are on each, so the plan carrying the platform is at
    the top rather than wherever the alphabet puts it.
  */
  const plans = [...new Set(rows.map((row) => row.termLabel))]
    .map((term) => ({ term, rows: rows.filter((row) => row.termLabel === term) }))
    .sort((a, b) => b.rows.length - a.rows.length || a.term.localeCompare(b.term));

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BanknoteIcon}
        tone="waiting"
        title="Nobody is subscribed yet"
        description="Every plan bought on the platform appears here with what it cost and when it runs out, so a renewal can be chased before somebody is locked out."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {plans.map(({ term, rows: inPlan }) => {
        const lapsing = inPlan.filter(
          (row) => !row.lifetime && row.daysLeft !== null && row.daysLeft <= 14,
        ).length;

        return (
          <section key={term} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {term}
                <span className="text-faint font-normal"> · {inPlan.length}</span>
              </h3>
              {/* The number worth acting on, beside the heading rather than
                  buried in a column somebody has to sort. */}
              {lapsing > 0 ? (
                <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
                  <ClockIcon className="size-3" />
                  {lapsing} ending or lapsed
                </Badge>
              ) : null}
            </div>

            <DataTable
              rows={inPlan}
              columns={columns}
              tabs={tabs}
              entityLabel="subscriptions"
              searchPlaceholder="Name or account id"
              searchText={(row) => `${row.name} ${row.accountId} ${row.kind} ${row.status}`}
              initialPageSize={10}
              empty={{
                icon: BanknoteIcon,
                title: "Nobody on this plan",
                description: "Accounts appear here as soon as they buy it.",
              }}
              expand={(row) => (
                <div className="flex flex-col gap-1.5 text-sm">
                  <span className="text-muted-foreground">
                    {row.lifetime
                      ? "A lifetime plan. It never expires and is never reminded."
                      : `Reminders can reach this account by: ${
                          row.reachable.length > 0
                            ? row.reachable.map((c) => CHANNEL_LABELS[c]).join(", ")
                            : "in-app only — no mobile number or email on file"
                        }.`}
                  </span>
                  {!row.lifetime && row.daysLeft !== null && row.daysLeft < 0 ? (
                    <span className="text-destructive flex items-center gap-1.5">
                      <XIcon className="size-3.5" />
                      This account cannot trade until it renews.
                    </span>
                  ) : null}
                </div>
              )}
              card={(row) => (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{row.name}</span>
                    <Badge variant="outline" className={STATUS_STYLE[row.status] ?? ""}>
                      {row.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {row.kind}
                    {row.amountLabel ? ` · ${row.amountLabel}` : ""}
                  </p>
                  <p className="text-faint text-xs">
                    {row.lifetime ? "Never runs out" : `Runs out ${row.renewsLabel}`}
                  </p>
                </div>
              )}
            />
          </section>
        );
      })}
    </div>
  );
}
