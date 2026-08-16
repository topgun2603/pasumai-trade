import { CheckIcon, InfinityIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/domain/money";
import { perMonth, savingPercent, type TermOption } from "@/lib/domain/subscription";
import { cn } from "@/lib/utils";

/**
 * One rung of the ladder.
 *
 * A server component with no state: which term is selected is the caller's
 * business, so the same card serves the public pricing page and the console
 * panel without either knowing how the other works.
 *
 * Three visual jobs, in order of how much they matter:
 *
 *  - the **price**, large, because that is what the eye is looking for;
 *  - the **effective monthly cost**, because ₹1999 for three years is
 *    meaningless until it reads as ₹56 a month, and that comparison is the
 *    entire argument for a longer term;
 *  - the **badge** they end up wearing, because on a marketplace the other
 *    side of the trade can see it.
 *
 * Lifetime is deliberately not styled like the rest. It is not a longer rung,
 * it is a different proposition — one payment and the question never comes
 * back — and making it look like a fourth shade of the same card buries that.
 */
export function PlanCard({
  option,
  selected = false,
  footer,
  compact = false,
}: {
  option: TermOption;
  selected?: boolean;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  const monthly = perMonth(option);
  const saving = savingPercent(option);
  const lifetime = option.highlight;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border p-4 transition-colors",
        lifetime
          ? "border-violet-500/50 bg-violet-500/[0.06] dark:bg-violet-500/[0.10]"
          : selected
            ? "border-primary/50 bg-accent"
            : "border-border bg-card",
        compact && "p-3",
      )}
    >
      {/* One ribbon slot, so a card can never carry two competing claims. */}
      {option.recommended ? (
        <span
          className={cn(
            "absolute -top-2.5 left-4 rounded-full px-2 py-0.5 text-[11px] font-medium",
            lifetime ? "bg-violet-600 text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {lifetime ? "Best value" : "Most popular"}
        </span>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-1.5 font-medium">
          {lifetime ? <InfinityIcon className="size-4 text-violet-600" /> : null}
          {option.label}
        </span>
        <Badge variant="outline" className={option.badge.className}>
          {lifetime ? <SparklesIcon className="size-3" /> : null}
          {option.badge.label}
        </Badge>
      </div>

      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            lifetime && "text-violet-600 dark:text-violet-400",
          )}
        >
          {formatMoney(option.price)}
        </span>

        {monthly !== undefined ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatMoney({ minorUnits: monthly, currency: option.price.currency })} a month
            {saving > 0 ? (
              <span className="text-success ml-1.5 font-medium">save {saving}%</span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
            Pay once. Never again.
          </span>
        )}
      </div>

      {lifetime && !compact ? (
        <ul className="flex flex-col gap-1.5 pt-1">
          {["No renewals, ever", "Price locked against every rise", "Founder badge on your listings"].map(
            (line) => (
              <li key={line} className="flex items-start gap-2 text-xs">
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-violet-600" />
                {line}
              </li>
            ),
          )}
        </ul>
      ) : null}

      {footer ? <div className="mt-auto pt-1">{footer}</div> : null}
    </div>
  );
}
