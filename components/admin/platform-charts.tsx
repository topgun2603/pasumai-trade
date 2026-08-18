"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { formatMoney, money } from "@/lib/domain/money";
import type {
  AccountMix,
  CropSupply,
  DayPoint,
  DistrictSupply,
  SettledRate,
} from "@/lib/domain/platform-analytics";

/**
 * Charts over what the platform actually recorded.
 *
 * Every one of these draws from a collection somebody wrote to. The set this
 * replaced drew from seeded fixtures and included a comparison against "the
 * mandi" — a feed this platform does not have and has never had.
 *
 * Each panel says in words what it would say with no data, rather than drawing
 * an empty axis. A chart with nothing in it looks like a chart that failed to
 * load, and an operator cannot tell "no trade yet" from "this page is broken".
 */

function Panel({
  title,
  hint,
  empty,
  children,
}: {
  title: string;
  hint?: string;
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex flex-col gap-0.5">
        <h3 className="font-medium">{title}</h3>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      {empty ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nothing recorded yet.
        </p>
      ) : (
        children
      )}
    </section>
  );
}

const ACTIVITY: ChartConfig = {
  listings: { label: "Listings", color: "var(--chart-1)" },
  bargains: { label: "Bargains", color: "var(--chart-2)" },
};

export function ActivityByDay({ data }: { data: DayPoint[] }) {
  const anything = data.some((point) => point.listings > 0 || point.bargains > 0);

  return (
    <Panel
      title="The last fortnight"
      hint="Listings posted and bargains opened, per day. Quiet days are drawn, not skipped."
      empty={!anything}
    >
      <ChartContainer config={ACTIVITY} className="h-56 w-full">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            // Just the day of the month: fourteen full dates will not fit and
            // the year is the same on all of them.
            tickFormatter={(day: string) => day.slice(8)}
            fontSize={11}
          />
          <YAxis tickLine={false} axisLine={false} width={24} allowDecimals={false} fontSize={11} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="listings"
            stroke="var(--color-listings)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey="bargains"
            stroke="var(--color-bargains)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </Panel>
  );
}

const SUPPLY: ChartConfig = { quantity: { label: "Listed", color: "var(--chart-1)" } };

export function SupplyByCrop({ data }: { data: CropSupply[] }) {
  return (
    <Panel
      title="What has been listed"
      hint="Quantity per crop, summed only within one unit — kilos and crates are never added together."
      empty={data.length === 0}
    >
      <ChartContainer config={SUPPLY} className="h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            type="category"
            dataKey="produceName"
            tickLine={false}
            axisLine={false}
            width={92}
            fontSize={11}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} />
        </BarChart>
      </ChartContainer>

      {/* The unit belongs beside the number, and a bar chart has nowhere to put
          it. A crop listed in two units says so here rather than pretending the
          total covers both. */}
      <ul className="flex flex-wrap gap-1.5">
        {data.map((crop) => (
          <li key={crop.produceName} className="text-muted-foreground text-xs">
            {crop.produceName} {crop.quantity} {crop.unit}
            {crop.mixedUnits ? (
              <span className="text-warning"> · other units not counted</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const DISTRICTS: ChartConfig = { listings: { label: "Listings", color: "var(--chart-3)" } };

export function SupplyByDistrict({ data }: { data: DistrictSupply[] }) {
  return (
    <Panel
      title="Where it is"
      hint="Listings per district, which is what a vehicle run is planned around."
      empty={data.length === 0}
    >
      <ChartContainer config={DISTRICTS} className="h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} />
          <YAxis
            type="category"
            dataKey="district"
            tickLine={false}
            axisLine={false}
            width={92}
            fontSize={11}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="listings" fill="var(--color-listings)" radius={4} />
        </BarChart>
      </ChartContainer>
    </Panel>
  );
}

export function SettledRates({ data }: { data: SettledRate[] }) {
  return (
    <Panel
      title="What settled, and at what"
      hint="The middle of every agreement per crop and grade. One distress sale should not move this."
      empty={data.length === 0}
    >
      <ul className="flex flex-col gap-2">
        {data.map((row) => (
          <li
            key={`${row.produceName}-${row.grade}-${row.unit}`}
            className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-0"
          >
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium">{row.produceName}</span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {row.grade}
              </Badge>
            </span>
            <span className="flex items-baseline gap-2">
              <span className="tabular text-sm font-semibold">
                {formatMoney(money(row.ratePerUnit))}
                <span className="text-muted-foreground text-xs font-normal">/{row.unit}</span>
              </span>
              <span className="text-faint text-xs">
                {row.agreements} agreement{row.agreements === 1 ? "" : "s"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function AccountsPanel({ data }: { data: AccountMix[] }) {
  const LABEL: Record<AccountMix["kind"], string> = {
    farmer: "Farmers",
    buyer: "Buyers and franchises",
    agency: "Agencies",
  };

  return (
    <Panel title="Who is on the platform" hint="Verified against still waiting on us.">
      <ul className="flex flex-col gap-3">
        {data.map((row) => (
          <li key={row.kind} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">{LABEL[row.kind]}</span>
              <span className="tabular text-sm">
                {row.verified}
                <span className="text-muted-foreground"> of {row.total} verified</span>
              </span>
            </div>
            {/* A bar rather than a chart: three rows of two numbers is a list,
                and drawing it as a chart would be decoration. */}
            <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-success h-full rounded-full"
                style={{ width: row.total > 0 ? `${(row.verified / row.total) * 100}%` : "0%" }}
              />
            </div>
            {row.waiting > 0 ? (
              <span className="text-warning text-xs">{row.waiting} waiting on us</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
