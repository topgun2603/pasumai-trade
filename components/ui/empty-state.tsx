import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * What a list says when it has nothing in it.
 *
 * These were a dozen hand-written sentences, several of them just "Nothing
 * waiting." with no icon and no explanation. That is the least useful moment to
 * be terse: an empty table is ambiguous in a way a full one never is, and the
 * reader is asking three questions at once — is this broken, is it filtered, or
 * is there genuinely nothing?
 *
 * ## The tone carries meaning, not decoration
 *
 * Colour here is the answer to "is this good or bad", which is the first thing
 * somebody wants from an empty screen and the thing a grey box cannot say.
 *
 *  - `done` — empty because the work is finished. A review queue with nothing
 *    in it is the best possible state, and it should look like it.
 *  - `waiting` — empty because nothing has happened yet. Neutral: a new
 *    platform has empty tables and that is not a fault.
 *  - `attention` — empty when something should be here. Rare, and the reason it
 *    is a separate tone is that it must never be mistaken for the other two.
 *  - `filtered` — not empty at all; the filters hide everything. A different
 *    problem with a different fix, and the one most often mistaken for a bug.
 *
 * Every tone tints only the icon and its disc. The text stays at full contrast:
 * a message set in a pale colour to match a badge is a message somebody outdoors
 * in bright sunlight cannot read, which is this platform's primary condition.
 */

const TONES = {
  done: "border-success/30 bg-success-soft text-success",
  waiting: "border-border bg-secondary text-muted-foreground",
  attention: "border-warning/40 bg-warning-soft text-warning",
  filtered: "border-primary/30 bg-accent text-primary",
} as const;

export type EmptyTone = keyof typeof TONES;

export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "waiting",
  action,
  className,
}: {
  icon: LucideIcon;
  /** One line, stating what is not here. */
  title: string;
  /**
   * What would put something here, in the reader's terms.
   *
   * The part that was missing everywhere. "Nothing waiting" tells somebody the
   * table is empty, which they can already see; what they cannot see is whether
   * to wait, to change a filter, or to go and do something.
   */
  description?: string;
  tone?: EmptyTone;
  /** A way out — clearing a filter, or the action that would create the first row. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-12 items-center justify-center rounded-full border",
          TONES[tone],
        )}
      >
        <Icon className="size-5" />
      </span>

      <span className="flex max-w-sm flex-col gap-1">
        <span className="text-foreground text-sm font-medium">{title}</span>
        {description ? (
          <span className="text-muted-foreground text-sm leading-relaxed">{description}</span>
        ) : null}
      </span>

      {action}
    </div>
  );
}
