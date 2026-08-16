"use client";

import { RadioIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { BargainConsole } from "@/components/negotiation/bargain-console";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import type { Negotiation, Party } from "@/lib/domain/negotiation";
import { fromWire, type WireNegotiation } from "@/lib/domain/negotiation-wire";
import { cn } from "@/lib/utils";

/**
 * The bargain console, kept current without a reload.
 *
 * The page still renders the threads on the server, so the first paint is
 * complete and correct with no JavaScript. This subscribes afterwards and
 * replaces them as they change — a progressive enhancement rather than a
 * dependency, which matters on a connection that drops.
 *
 * `EventSource` carries the session cookie itself and reconnects on its own,
 * so there is no retry loop here. Every reconnect brings a whole snapshot
 * rather than a diff, so nothing is missed in the gap and there is no
 * ordering problem to reason about.
 */
export function LiveBargains({
  initial,
  viewer,
  now,
  validForMinutes,
  remaining,
  editable,
  initialThreadId,
  /** Keeps the server-rendered filter — open only, or everything. */
  filter,
}: {
  initial: Negotiation[];
  viewer: Party;
  now: number;
  validForMinutes: number;
  /**
   * What is unsold per listing, from the server.
   *
   * Not recomputed as threads stream in: the browser only sees this account's
   * bargains, so it cannot know what another buyer has taken. A stale limit
   * here costs a refused send with a clear reason; a limit invented here would
   * cost a lot sold twice.
   */
  remaining?: Readonly<Record<string, readonly GradeQuantity[]>>;
  editable: boolean;
  initialThreadId?: string;
  filter?: "open";
}) {
  const [threads, setThreads] = useState(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/negotiations/stream");

    source.addEventListener("open", () => setLive(true));

    source.addEventListener("threads", (event) => {
      const wire = JSON.parse((event as MessageEvent<string>).data) as WireNegotiation[];
      const all = wire.map(fromWire);
      setLive(true);
      setThreads(
        // The same filter the page applied, or a settled bargain would appear
        // in the live section the moment somebody accepted it.
        filter === "open" ? all.filter((t) => t.status === "open") : all,
      );
    });

    // EventSource reports both a dropped connection and the deliberate close
    // at the end of each window as an error, then reconnects on its own. So
    // this only dims the indicator; it never tears anything down.
    source.addEventListener("error", () => setLive(false));

    return () => source.close();
  }, [filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <span
        className={cn(
          "flex items-center gap-1.5 self-end text-xs transition-colors",
          live ? "text-success" : "text-muted-foreground",
        )}
        // Announced, because "is this up to date" is the question this answers
        // and a farmer waiting on an offer will ask it.
        aria-live="polite"
      >
        {live ? (
          <>
            <RadioIcon className="size-3.5" />
            Live
          </>
        ) : (
          <>
            <WifiOffIcon className="size-3.5" />
            Reconnecting…
          </>
        )}
      </span>

      <BargainConsole
        threads={threads}
        viewer={viewer}
        now={now}
        validForMinutes={validForMinutes}
        remaining={remaining}
        editable={editable}
        initialThreadId={initialThreadId}
      />
    </div>
  );
}
