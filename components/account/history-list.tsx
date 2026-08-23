import { ArrowRightIcon, HistoryIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { AUDIT_LABELS, type AuditEntry } from "@/lib/domain/audit";
import { relativeTime } from "@/lib/format";

/**
 * What happened, most recent first.
 *
 * Bug 13 asked for timestamp, actor, previous value and new value, and the
 * previous/new pair is the part that does the work — "the quantity changed"
 * settles nothing, "500 kg → 300 kg" settles it.
 *
 * Rows carry a kind and a few facts rather than a written sentence, the same
 * way notifications do, so the same record reads correctly to a farmer in one
 * language and an operator in another. The label comes from a table, not from
 * whatever the writer typed at the time.
 */
export function HistoryList({
  entries,
  now,
  emptyHint,
}: {
  entries: readonly AuditEntry[];
  /** From the server, so the relative times match either side of hydration. */
  now: number;
  emptyHint: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        tone="done"
        title="Nothing has changed yet"
        description={emptyHint}
      />
    );
  }

  return (
    <ol className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-medium">{AUDIT_LABELS[entry.action]}</span>
            <time
              dateTime={entry.at.toISOString()}
              title={entry.at.toLocaleString("en-IN")}
              className="text-faint shrink-0 text-xs"
            >
              {relativeTime(entry.at, now)}
            </time>
          </div>

          {/*
            The pair, where there is one. Some actions — a listing withdrawn,
            an order placed — change no single value and would render an
            arrow between two dashes if this were unconditional.
          */}
          {entry.from !== undefined || entry.to !== undefined ? (
            <span className="tabular flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground line-through decoration-1">
                {entry.from ?? "—"}
              </span>
              <ArrowRightIcon className="text-faint size-3.5 shrink-0" />
              <span className="font-medium">{entry.to ?? "—"}</span>
            </span>
          ) : null}

          <span className="text-muted-foreground text-xs">
            {entry.actor.name}
            {entry.actor.role === "admin" ? " · operations" : ""}
            {entry.note ? ` · ${entry.note}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
