import { HandshakeIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { GRADE_LABELS } from "@/lib/domain/enums";
import type { Sale } from "@/lib/domain/farm-analytics";
import { formatMoney, formatRate, money } from "@/lib/domain/money";
import { formatQuantity } from "@/lib/domain/quantity";
import { relativeTime } from "@/lib/format";

/**
 * Every price this farmer has settled, as a record rather than a job list.
 *
 * The same settlements appear under Logistics, where they carry a Call a
 * vehicle button because collection still has to be arranged. This is the
 * other question about the same rows — what did I sell, to whom, for how much
 * — and it has no buttons at all. A history somebody can act on is a work
 * queue wearing a different name.
 *
 * One line per grade, not per bargain: a lot settled at two grades settled at
 * two prices, and averaging them would hide the thing worth knowing.
 */
export function BargainLog({
  sales,
  now,
}: {
  sales: readonly Sale[];
  /** From the server, so the relative times agree either side of hydration. */
  now: number;
}) {
  if (sales.length === 0) {
    return (
      <EmptyState
        icon={HandshakeIcon}
        tone="done"
        title="Nothing settled yet"
        description="When a bargain is agreed it appears here with the rate it settled at, so you can see what your crop has been worth."
      />
    );
  }

  return (
    <ol className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
      {sales.map((sale) => (
        <li key={`${sale.id}-${sale.grade}`} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-medium">
              {sale.produceName}
              <span className="text-muted-foreground font-normal">
                {" "}
                · grade {GRADE_LABELS[sale.grade]}
              </span>
            </span>
            <time
              dateTime={sale.settledAt.toISOString()}
              title={sale.settledAt.toLocaleString("en-IN")}
              className="text-faint shrink-0 text-xs"
            >
              {relativeTime(sale.settledAt, now)}
            </time>
          </div>

          <span className="tabular flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-semibold">
              {formatRate(money(sale.ratePerUnit), sale.unit)}
            </span>
            <span className="text-muted-foreground">
              × {formatQuantity(sale.quantity, sale.unit)}
            </span>
            <span>
              = {formatMoney(sale.value)}
              {/*
                Said, not hidden. A bargain records one quantity for the lot
                rather than a split per grade, so a two-grade settlement
                divides it — the total is an estimate until grading at pickup
                is recorded against the order.
              */}
              {sale.apportioned ? (
                <span className="text-faint text-xs"> · estimated split</span>
              ) : null}
            </span>
          </span>

          <span className="text-muted-foreground text-xs">{sale.buyerName}</span>
        </li>
      ))}
    </ol>
  );
}
