"use client";

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { PriceHistoryChart } from "@/components/farm/price-history-chart";
import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatQuantity } from "@/lib/domain/quantity";
import { GRADES } from "@/lib/domain/enums";
import {
  cropsIn,
  priceHistory,
  summarise,
  trend,
  type Sale,
} from "@/lib/domain/farm-analytics";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/**
 * The farmer's own trade, filterable.
 *
 * The crop filter sits above everything and drives the whole page — the
 * summary, the chart and the table all narrow together. A farmer asking "what
 * is my tomato worth" wants one answer, not a chart of tomatoes beside an
 * average that still includes their onions.
 *
 * The table runs through DataTable, so search, sorting, the grade tabs and the
 * card view behave the way they do everywhere else in the console.
 */
export function SalesAnalytics({ sales }: { sales: Sale[] }) {
  const [crop, setCrop] = useState("all");

  const crops = useMemo(() => cropsIn(sales), [sales]);
  const scoped = useMemo(
    () => (crop === "all" ? sales : sales.filter((s) => s.produceName === crop)),
    [sales, crop],
  );

  const totals = useMemo(() => summarise(scoped), [scoped]);
  const points = useMemo(() => priceHistory(scoped), [scoped]);

  const columns: Column<Sale>[] = [
    {
      key: "produce",
      header: "Produce",
      sortValue: (s) => s.produceName,
      cell: (s) => <span className="font-medium">{s.produceName}</span>,
    },
    {
      key: "grade",
      header: "Grade",
      sortValue: (s) => s.grade,
      cell: (s) => (
        <Badge variant="outline" className="font-medium">
          {s.grade.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      className: "text-right",
      sortValue: (s) => s.ratePerUnit,
      cell: (s) => (
        <span className="tabular-nums">
          {formatMoney({ minorUnits: s.ratePerUnit, currency: "INR" })}/{s.unit}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      className: "text-right",
      sortValue: (s) => s.quantity,
      cell: (s) => (
        <span className="tabular-nums">
          {formatQuantity(s.quantity, s.unit)}
          {/* Said, not hidden: a two-grade bargain records one quantity, so
              this half is a division rather than a weighing. */}
          {s.apportioned ? <span className="text-faint ml-1 text-xs">split</span> : null}
        </span>
      ),
    },
    {
      key: "value",
      header: "Value",
      className: "text-right",
      sortValue: (s) => s.value.minorUnits,
      cell: (s) => <span className="font-medium tabular-nums">{formatMoney(s.value)}</span>,
    },
    { key: "buyer", header: "Buyer", sortValue: (s) => s.buyerName, cell: (s) => s.buyerName },
    {
      key: "settled",
      header: "Settled",
      sortValue: (s) => s.settledAt.getTime(),
      cell: (s) => (
        <span className="text-muted-foreground text-xs">
          {s.settledAt.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
  ];

  const tabs: FilterTab<Sale>[] = [
    { value: "all", label: "All grades" },
    ...GRADES.map((grade) => ({
      value: grade,
      label: `Grade ${grade.toUpperCase()}`,
      match: (s: Sale) => s.grade === grade,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Crop</span>
          <Select value={crop} onValueChange={setCrop}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every crop</SelectItem>
              {crops.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {totals.lots} bargain{totals.lots === 1 ? "" : "s"} · {formatQuantity(totals.quantity, totals.unit)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Earned" value={formatMoney(totals.earned)} hint="Across settled bargains" />
        {GRADES.map((grade) => {
          const row = totals.byGrade.find((g) => g.grade === grade);
          const movement = trend(scoped, grade);
          return (
            <Tile
              key={grade}
              label={`Grade ${grade.toUpperCase()} average`}
              value={
                row
                  ? `${formatMoney({ minorUnits: row.rate, currency: "INR" })}/${totals.unit}`
                  : "—"
              }
              hint={row ? `${formatQuantity(row.quantity, totals.unit)} sold` : "Nothing sold at this grade"}
              movement={movement?.changePercent}
            />
          );
        })}
      </div>

      <section className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">What it settled at</h2>
          <p className="text-muted-foreground text-sm">
            Every agreed rate, by grade. This is your own history — not a published index, and not
            what anyone else got.
          </p>
        </div>
        <PriceHistoryChart points={points} />
      </section>

      <DataTable
        rows={scoped}
        columns={columns}
        tabs={tabs}
        entityLabel="sales"
        searchPlaceholder="Search by crop or buyer"
        searchText={(s) => `${s.produceName} ${s.buyerName} ${s.grade}`}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  movement,
}: {
  label: string;
  value: string;
  hint: string;
  /** Percent against the average of earlier sales. Undefined when there is nothing to compare. */
  movement?: number;
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-heading text-2xl leading-none tracking-tight tabular-nums">
        {value}
      </span>
      <span className="flex items-center gap-1.5 text-xs">
        {movement !== undefined && movement !== 0 ? (
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium tabular-nums",
              movement > 0 ? "text-success" : "text-destructive",
            )}
          >
            {movement > 0 ? (
              <TrendingUpIcon className="size-3" />
            ) : (
              <TrendingDownIcon className="size-3" />
            )}
            {movement > 0 ? "+" : ""}
            {movement}%
          </span>
        ) : null}
        <span className="text-faint">{hint}</span>
      </span>
    </div>
  );
}
