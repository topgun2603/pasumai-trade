import { CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/domain/money";
import { priceFor, yearlySaving, type BillingPeriod, type Plan } from "@/lib/domain/subscription";
import { cn } from "@/lib/utils";

/**
 * One plan, priced.
 *
 * A server component with no state of its own: the period is decided by
 * whoever renders it, so the same card serves the public pricing page and the
 * console panel without either needing to know how the other works.
 */
export function PlanCard({
  plan,
  period,
  highlight = false,
  footer,
}: {
  plan: Plan;
  period: BillingPeriod;
  highlight?: boolean;
  footer?: React.ReactNode;
}) {
  const price = priceFor(plan, period);
  const saving = yearlySaving(plan);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5",
        highlight ? "border-primary/40 bg-accent shadow-sm" : "border-border bg-card",
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{plan.name}</h3>
          {period === "yearly" && saving > 0 ? (
            <Badge variant="outline" className="border-success/40 text-success">
              Save {saving}%
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{plan.blurb}</p>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatMoney(price)}
        </span>
        <span className="text-muted-foreground text-sm">
          {period === "yearly" ? "per year" : "per month"}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {plan.includes.map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm">
            <CheckIcon className="text-success mt-0.5 size-4 shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {footer ? <div className="mt-auto pt-1">{footer}</div> : null}
    </div>
  );
}
