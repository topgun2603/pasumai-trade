import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { CropVolume, FreshnessSplit } from "@/lib/domain/analytics";
import { formatMoney, money, type Money } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/**
 * The commercial snapshot on the admin overview.
 *
 * The overview's job is "what needs a decision today", and until now it only
 * answered that for compliance — approvals and lapsing documents. This adds
 * the trading half: what is on the shelf, what will be worthless tomorrow,
 * and where the price sits against the mandi.
 *
 * Deliberately not charts. This is the page someone opens first thing in the
 * morning; it should be readable in one glance, and the charts are one click
 * away on Analytics.
 */
export function OverviewSnapshot({
  stock,
  freshness,
  crops,
}: {
  stock: Money;
  freshness: FreshnessSplit;
  crops: CropVolume[];
}) {
  const priced = crops.filter((c) => c.mandiLow > 0);
  const cheapest = [...priced].sort((a, b) => a.vsMandi - b.vsMandi)[0];
  const dearest = [...priced].sort((a, b) => b.vsMandi - a.vsMandi)[0];

  return (
    <section className="bg-card flex flex-col rounded-lg border xl:col-span-2">
      <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-medium">Trading snapshot</h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/analytics">Open analytics</Link>
        </Button>
      </div>

      <dl className="bg-border grid grid-cols-2 gap-px lg:grid-cols-4">
        <div className="bg-card flex flex-col gap-1 px-4 py-4">
          <dt className="text-muted-foreground text-sm">On the shelf</dt>
          <dd className="tabular text-xl font-semibold">{formatMoney(stock)}</dd>
          <p className="text-faint text-xs">Graded stock, priced at live rates</p>
        </div>

        <div className="bg-card flex flex-col gap-1 px-4 py-4">
          <dt className="text-muted-foreground text-sm">Unsellable tomorrow</dt>
          <dd
            className={cn(
              "tabular text-xl font-semibold",
              freshness.atRisk.minorUnits > 0 ? "text-destructive" : "",
            )}
          >
            {formatMoney(freshness.atRisk)}
          </dd>
          <p className="text-faint text-xs">
            {freshness.endOfLife} line{freshness.endOfLife === 1 ? "" : "s"} inside 24
            hours
          </p>
        </div>

        {cheapest ? (
          <div className="bg-card flex flex-col gap-1 px-4 py-4">
            <dt className="text-muted-foreground text-sm">Best against mandi</dt>
            <dd className="tabular text-success text-xl font-semibold">
              {cheapest.vsMandi.toFixed(0)}%
            </dd>
            <p className="text-faint text-xs">{cheapest.crop}</p>
          </div>
        ) : null}

        {dearest ? (
          <div className="bg-card flex flex-col gap-1 px-4 py-4">
            <dt className="text-muted-foreground text-sm">Worst against mandi</dt>
            <dd
              className={cn(
                "tabular text-xl font-semibold",
                dearest.vsMandi > 0 ? "text-warning" : "text-success",
              )}
            >
              {dearest.vsMandi > 0 ? "+" : ""}
              {dearest.vsMandi.toFixed(0)}%
            </dd>
            <p className="text-faint text-xs">{dearest.crop}</p>
          </div>
        ) : null}
      </dl>

      {/* Top crops as a compact bar list rather than a chart — enough to see
          the shape without leaving the page. */}
      <div className="flex flex-col gap-2.5 border-t px-4 py-4">
        <span className="text-muted-foreground text-sm">Largest holdings</span>
        <ul className="flex flex-col gap-2">
          {crops.slice(0, 5).map((crop) => {
            const share = crops[0].value ? (crop.value / crops[0].value) * 100 : 0;
            return (
              <li key={crop.crop} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{crop.crop}</span>
                <span className="bg-secondary h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-chart-1 block h-full rounded-full"
                    style={{ width: `${Math.max(share, 3)}%` }}
                  />
                </span>
                <span className="tabular w-24 shrink-0 text-right text-sm">
                  {formatMoney(money(crop.value))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
