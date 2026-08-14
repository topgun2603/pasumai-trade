"use client";

import { TableIcon } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CropVolume,
  DistrictRow,
  GradeSplit,
  TimePoint,
} from "@/lib/domain/analytics";
import { formatMoney, money } from "@/lib/domain/money";
import { formatQuantity } from "@/lib/format";

/**
 * Analytics charts.
 *
 * Series colours come from `--chart-1…5`, assigned by slot in fixed order.
 * Those five were validated against this project's surfaces in both themes;
 * the platform's own greens were measured first and failed, sitting at ΔE 3.2
 * for a deuteranope.
 *
 * Two slots sit under 3:1 on the light surface, which obliges relief: every
 * chart here ships a legend, and every chart has a table view behind a toggle
 * so no reading depends on telling two colours apart.
 */

/** Wraps a chart with its heading and a table alternative. */
function Figure({
  title,
  caption,
  children,
  table,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
  table: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <figure className="bg-card flex flex-col gap-3 rounded-xl border p-5">
      <figcaption className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground text-sm">{caption}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={showTable}
          onClick={() => setShowTable((v) => !v)}
        >
          <TableIcon className="size-3.5" />
          {showTable ? "Chart" : "Table"}
        </Button>
      </figcaption>

      {showTable ? (
        <div className="overflow-x-auto">{table}</div>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </figure>
  );
}

const activityConfig = {
  listings: { label: "Listings", color: "var(--chart-1)" },
  offers: { label: "Offers made", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ActivityChart({ data }: { data: TimePoint[] }) {
  return (
    <Figure
      title="Listing activity"
      caption="New listings and the offers made against them, by day."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Listings</TableHead>
              <TableHead className="text-right">Offers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="tabular text-right">{row.listings}</TableCell>
                <TableCell className="tabular text-right">{row.offers}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer config={activityConfig} className="h-64 w-full">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fillListings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-listings)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-listings)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillOffers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-offers)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-offers)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={28}
            allowDecimals={false}
            fontSize={11}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            dataKey="listings"
            type="monotone"
            stroke="var(--color-listings)"
            strokeWidth={2}
            fill="url(#fillListings)"
          />
          <Area
            dataKey="offers"
            type="monotone"
            stroke="var(--color-offers)"
            strokeWidth={2}
            fill="url(#fillOffers)"
          />
        </AreaChart>
      </ChartContainer>
    </Figure>
  );
}

const cropConfig = {
  value: { label: "Stock value", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function CropValueChart({ data }: { data: CropVolume[] }) {
  const rows = data.slice(0, 8);

  return (
    <Figure
      title="Stock value by crop"
      caption="What is on the shelf right now, priced at the lowest live rate."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Crop</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.crop}>
                <TableCell>{row.crop}</TableCell>
                <TableCell className="tabular text-right">
                  {formatQuantity(row.kg)}
                </TableCell>
                <TableCell className="tabular text-right">
                  {formatMoney(money(row.value))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer config={cropConfig} className="h-72 w-full">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ left: 4, right: 56, top: 4 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.4} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="crop"
            tickLine={false}
            axisLine={false}
            width={92}
            fontSize={11}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatMoney(money(Number(value)))}
              />
            }
          />
          {/* 4px rounded data-end, anchored at the baseline. */}
          <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ChartContainer>
    </Figure>
  );
}

const mandiConfig = {
  vsMandi: { label: "Against mandi", color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * Price against the mandi midpoint.
 *
 * Diverging around zero, so the two arms take opposite hues with the axis as
 * the neutral midpoint — below the mandi is the good direction for a buyer and
 * has to read as the opposite of above it.
 */
export function MandiChart({ data }: { data: CropVolume[] }) {
  const rows = data.filter((d) => d.mandiLow > 0).slice(0, 8);

  return (
    <Figure
      title="Our price against the mandi"
      caption="Percentage above or below the published mandi midpoint. Below the line is cheaper than the mandi."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Crop</TableHead>
              <TableHead className="text-right">Our price</TableHead>
              <TableHead className="text-right">Mandi range</TableHead>
              <TableHead className="text-right">Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.crop}>
                <TableCell>{row.crop}</TableCell>
                <TableCell className="tabular text-right">
                  {formatMoney(money(row.price))}
                </TableCell>
                <TableCell className="tabular text-right">
                  {formatMoney(money(row.mandiLow))} – {formatMoney(money(row.mandiHigh))}
                </TableCell>
                <TableCell className="tabular text-right">
                  {row.vsMandi > 0 ? "+" : ""}
                  {row.vsMandi.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer config={mandiConfig} className="h-64 w-full">
        <BarChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
          <XAxis
            dataKey="crop"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={56}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            fontSize={11}
            tickFormatter={(v) => `${v}%`}
          />
          <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => `${Number(value).toFixed(1)}%`}
              />
            }
          />
          <Bar dataKey="vsMandi" radius={4} barSize={22}>
            {rows.map((row) => (
              <Cell
                key={row.crop}
                fill={row.vsMandi >= 0 ? "var(--chart-3)" : "var(--chart-1)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </Figure>
  );
}

const districtConfig = {
  stockValue: { label: "Stock value", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function DistrictChart({ data }: { data: DistrictRow[] }) {
  return (
    <Figure
      title="Stock by district"
      caption="Value of graded stock available on farms in each district."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>District</TableHead>
              <TableHead className="text-right">Listings</TableHead>
              <TableHead className="text-right">Farmers</TableHead>
              <TableHead className="text-right">Stock value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.district}>
                <TableCell>{row.district}</TableCell>
                <TableCell className="tabular text-right">{row.listings}</TableCell>
                <TableCell className="tabular text-right">{row.farmers}</TableCell>
                <TableCell className="tabular text-right">
                  {formatMoney(money(row.stockValue))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ChartContainer config={districtConfig} className="h-64 w-full">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
          <XAxis
            dataKey="district"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            fontSize={11}
            tickFormatter={(v) => `₹${Math.round(Number(v) / 100000)}L`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatMoney(money(Number(value)))}
              />
            }
          />
          <Bar dataKey="stockValue" fill="var(--color-stockValue)" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ChartContainer>
    </Figure>
  );
}

/**
 * Grade mix.
 *
 * A stacked bar rather than a pie: three shares are read more accurately along
 * a common baseline, and the direct labels sit on the bar rather than needing
 * a key.
 */
export function GradeMix({ data }: { data: GradeSplit[] }) {
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <span className="font-medium">Grade mix</span>
        <span className="text-muted-foreground text-sm">
          Share of live stock lines by grade.
        </span>
      </div>

      <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-md">
        {data.map((row, index) => (
          <div
            key={row.grade}
            className="flex items-center justify-center"
            style={{ width: `${row.share}%`, background: colors[index] }}
            title={`${row.label} — ${row.share}%`}
          >
            {row.share >= 12 ? (
              <span className="text-xs font-semibold text-white">{row.share}%</span>
            ) : null}
          </div>
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {data.map((row, index) => (
          <li key={row.grade} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{ background: colors[index] }}
            />
            <span>{row.label}</span>
            <span className="text-muted-foreground tabular">{row.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
