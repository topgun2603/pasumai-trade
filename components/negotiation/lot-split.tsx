import { FlameIcon, GavelIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { GRADE_LABELS } from "@/lib/domain/enums";
import type { LotBook } from "@/lib/domain/lot-book";
import { cn } from "@/lib/utils";

/**
 * How much of a lot is sold, how much is left, and how much is being fought over.
 *
 * A bar for the first two and a sentence for the third, and the split is the
 * point. Sold and left are slices of one quantity; demand is a different
 * quantity that overlaps itself and can exceed the lot — three buyers each
 * bidding for four hundred of five hundred left is twelve hundred under
 * bargain. Drawing that as a third segment would either be a lie about the
 * arithmetic or a bar that runs off the end of the row.
 *
 * Reads the same for a farmer and a buyer, from opposite ends: the farmer sees
 * how much of their field is spoken for, the buyer sees how much competition
 * they have. `you` splits their own bid out of the demand; without it, all of
 * it reads as somebody else's, which is what the farmer wants.
 *
 * Deliberately carries no rates. What rival buyers are *paying* is theirs; how
 * much they want is market depth and belongs to both sides.
 */
export function LotSplit({
  book,
  unit,
  /** Buyer's view: their own bid is called out from the rest. */
  you = false,
  compact = false,
  className,
}: {
  book: LotBook;
  unit: string;
  you?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { posted, sold, remaining, yours, others, bidders, oversubscribed, soldOut } = book;
  if (posted === 0) return null;

  const demand = yours + others;
  const soldPercent = Math.round((sold / posted) * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="bg-secondary flex h-1.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${sold} of ${posted} ${unit} sold, ${remaining} still available`}
      >
        <div
          className="bg-success h-full transition-[width]"
          style={{ width: `${soldPercent}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {sold > 0 ? (
          <span className="text-success tabular font-medium">
            {sold} {unit} sold
          </span>
        ) : null}

        <span className={cn("tabular", soldOut ? "text-muted-foreground" : "font-medium")}>
          {soldOut ? "nothing left" : `${remaining} ${unit} left`}
        </span>

        {demand > 0 ? (
          <span className="text-muted-foreground flex items-center gap-1">
            <GavelIcon className="size-3 shrink-0" />
            {you && yours > 0 ? (
              <>
                <span className="text-foreground tabular font-medium">
                  you bid {yours} {unit}
                </span>
                {others > 0 ? (
                  <>
                    {" · "}
                    <span className="tabular">
                      {bidders - 1 === 1
                        ? `1 other wants ${others} ${unit}`
                        : `${bidders - 1} others want ${others} ${unit}`}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="tabular">
                {bidders} {bidders === 1 ? "buyer" : "buyers"} bargaining for {others + yours}{" "}
                {unit}
              </span>
            )}
          </span>
        ) : null}

        {oversubscribed ? (
          // The moment worth naming. More is wanted than exists, which is the
          // farmer's signal to hold and the buyer's to stop shaving the price.
          <Badge
            variant="outline"
            className="border-warning/40 bg-warning-soft text-warning gap-1 py-0"
          >
            <FlameIcon className="size-3" />
            More wanted than left
          </Badge>
        ) : null}
      </div>

      {!compact && book.lines.length > 1 ? (
        <div className="text-faint flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          {book.lines.map((line) => (
            <span key={line.grade} className="tabular">
              {GRADE_LABELS[line.grade]}: {line.remaining}/{line.posted}
              {line.others + line.yours > 0 ? ` · ${line.others + line.yours} wanted` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
