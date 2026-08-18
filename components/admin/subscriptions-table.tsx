"use client";

import { useState } from "react";

import { BanknoteIcon, CheckIcon, ClockIcon, InfinityIcon, XIcon } from "lucide-react";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { describePlan } from "@/lib/domain/subscription";
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

/**
 * A colour per plan, cycled.
 *
 * Not semantic — no plan is more urgent than another — so these are the chart
 * tokens rather than success/warning/danger, which mean something specific
 * everywhere else on this platform and would be lying here. The point is only
 * that four sections down a long page stay tellable apart while scrolling, and
 * that the page stops being a column of identical grey boxes.
 *
 * Assigned by position so it is stable for a given set of plans, and the tint
 * is faint enough that the cards inside keep their own contrast.
 */
const PLAN_TINTS = [
  { panel: "bg-chart-1/5 border-chart-1/20", dot: "bg-chart-1", text: "text-chart-1" },
  { panel: "bg-chart-2/5 border-chart-2/20", dot: "bg-chart-2", text: "text-chart-2" },
  { panel: "bg-chart-3/5 border-chart-3/20", dot: "bg-chart-3", text: "text-chart-3" },
  { panel: "bg-chart-4/5 border-chart-4/20", dot: "bg-chart-4", text: "text-chart-4" },
  { panel: "bg-chart-5/5 border-chart-5/20", dot: "bg-chart-5", text: "text-chart-5" },
];

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

  /*
    Filters within one plan, not across them.

    "Lifetime" used to be one of these and no longer makes sense: a plan is
    lifetime or it is not, so inside the six-month tab it read "Lifetime 0" —
    a filter that can only ever be empty. Grouping by plan answered that
    question already.
  */
  const tabs: FilterTab<SubscriptionRow>[] = [
    { value: "all", label: "All" },
    {
      value: "ending",
      label: "Ending soon",
      match: (row) =>
        !row.lifetime && row.daysLeft !== null && row.daysLeft >= 0 && row.daysLeft <= 14,
    },
    {
      value: "lapsed",
      label: "Lapsed",
      match: (row) => !row.lifetime && row.daysLeft !== null && row.daysLeft < 0,
    },
  ];

  /*
    Tabs rather than a stack.

    Five plans stacked meant five search boxes, five paginators and a page you
    scroll through to reach the one you wanted. Operations look at one plan at a
    time — how many on six months, which of the monthly ones lapse this week —
    so one is shown at a time, and the rest are a click away with their counts
    already visible.

    Ordered by how many are on each, so the plan carrying the platform is the
    one that opens.
  */
  const plans = [...new Set(rows.map((row) => row.termLabel))]
    .map((term) => ({
      term,
      plan: describePlan(term),
      rows: rows.filter((row) => row.termLabel === term),
    }))
    .sort((a, b) => b.rows.length - a.rows.length || a.plan.title.localeCompare(b.plan.title));

  const [openPlan, setOpenPlan] = useState(plans[0]?.term ?? "");
  const active = plans.find((plan) => plan.term === openPlan) ?? plans[0];

  if (rows.length === 0 || !active) {
    return (
      <EmptyState
        icon={BanknoteIcon}
        tone="waiting"
        title="Nobody is subscribed yet"
        description="Every plan bought on the platform appears here with what it cost and when it runs out, so a renewal can be chased before somebody is locked out."
      />
    );
  }

  const activeTint = PLAN_TINTS[plans.indexOf(active) % PLAN_TINTS.length];
  const lapsing = active.rows.filter(
    (row) => !row.lifetime && row.daysLeft !== null && row.daysLeft <= 14,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* One tab per plan, each carrying its own count and colour so the shape
          of the book is visible without opening every chapter. */}
      <div
        role="tablist"
        aria-label="Plans"
        className="border-border flex flex-wrap gap-1 border-b pb-2"
      >
        {plans.map((plan, index) => {
          const tint = PLAN_TINTS[index % PLAN_TINTS.length];
          const open = plan.term === active.term;

          return (
            <button
              key={plan.term}
              type="button"
              role="tab"
              aria-selected={open}
              onClick={() => setOpenPlan(plan.term)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                open
                  ? cn("font-medium", tint.panel, tint.text)
                  : "border-transparent text-muted-foreground hover:bg-secondary",
              )}
            >
              <span aria-hidden className={cn("size-2 rounded-full", tint.dot)} />
              {plan.plan.title}
              {plan.plan.tier ? (
                <span className="text-muted-foreground text-xs font-normal">
                  {plan.plan.tier}
                </span>
              ) : null}
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-xs",
                  open ? "bg-background/70" : "bg-secondary",
                )}
              >
                {plan.rows.length}
              </span>
            </button>
          );
        })}
      </div>

      <section className={cn("flex flex-col gap-3 rounded-xl border p-4", activeTint.panel)}>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden className={cn("size-2 rounded-full", activeTint.dot)} />
          <h3 className={cn("font-medium", activeTint.text)}>
            {active.plan.title}
            {active.plan.tier ? (
              <span className="text-muted-foreground font-normal"> · {active.plan.tier}</span>
            ) : null}
          </h3>
          <span className="text-muted-foreground text-sm">
            {active.rows.length} subscription{active.rows.length === 1 ? "" : "s"}
          </span>

          {/* A plan nobody can buy any more, still being paid for. Worth saying
              rather than leaving somebody to wonder why it is not on pricing. */}
          {active.plan.retired ? (
            <Badge variant="outline" className="text-muted-foreground">
              No longer sold
            </Badge>
          ) : null}

          {lapsing > 0 ? (
            <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
              <ClockIcon className="size-3" />
              {lapsing} ending or lapsed
            </Badge>
          ) : null}
        </div>

        <DataTable
          // Keyed by plan, so switching tabs resets the search and the page
          // rather than carrying one plan's filter onto another's list.
          key={active.term}
          rows={active.rows}
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
    </div>
  );
}
