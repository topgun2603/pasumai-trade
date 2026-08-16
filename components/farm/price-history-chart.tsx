"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PricePoint } from "@/lib/domain/farm-analytics";

/**
 * What each grade settled at, over time.
 *
 * Three lines rather than one average, because the averages of A and C are
 * different questions and a single line answers neither. Grade colours match
 * the ones the rest of the console uses for grades, so a farmer reads them
 * without a legend the first time and with one thereafter.
 *
 * Gaps are gaps. A day with no sale draws no point and the line bridges it —
 * plotting zero would show a price collapse where there was simply no trade,
 * which is the most alarming thing a chart can lie about to somebody deciding
 * whether to accept an offer.
 */
const CONFIG = {
  a: { label: "Grade A", color: "var(--chart-1)" },
  b: { label: "Grade B", color: "var(--chart-2)" },
  c: { label: "Grade C", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function PriceHistoryChart({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return (
      <div className="border-border text-muted-foreground flex h-56 items-center justify-center rounded-lg border border-dashed text-sm">
        {points.length === 0
          ? "No settled sales yet. Prices appear here once you agree one."
          : "One sale so far. A second gives this something to compare against."}
      </div>
    );
  }

  return (
    <ChartContainer config={CONFIG} className="h-64 w-full">
      <LineChart data={points} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          fontSize={11}
          // Rupees, because this axis is read by a person. Everything else in
          // the codebase stays in paise.
          tickFormatter={(v: number) => `₹${v}`}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        {(["a", "b", "c"] as const).map((grade) => (
          <Line
            key={grade}
            dataKey={grade}
            type="monotone"
            stroke={`var(--color-${grade})`}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
            // Bridges days with no sale rather than dropping the line to zero.
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
