"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { PriceLine } from "@/app/api/market/prices/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fill, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FRESHNESS_STYLE: Record<PriceLine["freshness"], string> = {
  fresh: "border-success/40 bg-success-soft text-success",
  useSoon: "border-warning/40 bg-warning-soft text-warning",
  endOfLife: "border-destructive/40 bg-destructive-soft text-destructive",
};

type State =
  | { status: "loading" }
  | { status: "ready"; lines: PriceLine[]; asOf: string }
  | { status: "error" };

/**
 * Today's indicative prices.
 *
 * Fetched on the client on purpose. The landing page is statically prerendered
 * — which is what keeps it fast and search-indexable — and reading request-time
 * data on the server would make the whole route dynamic. Fetching after mount
 * keeps the page static and the prices live, at the cost of a moment where
 * there is nothing to show. That moment is what the skeleton is for.
 */
export function LivePrices({ t }: { t: Dictionary }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/market/prices", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as {
          asOf: string;
          lines: PriceLine[];
        };
        if (!cancelled) {
          setState({ status: "ready", lines: data.lines, asOf: data.asOf });
        }
      } catch {
        // An aborted fetch is a component unmount, not a failure.
        if (!cancelled && !controller.signal.aborted) {
          setState({ status: "error" });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadKey]);

  function reload() {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }

  const freshnessLabel: Record<PriceLine["freshness"], string> = {
    fresh: t.prices.fresh,
    useSoon: t.prices.useSoon,
    endOfLife: t.prices.endOfLife,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {t.prices.title}
          </h2>
          <p className="text-muted-foreground">{t.prices.body}</p>
        </div>

        {state.status === "ready" ? (
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCwIcon className="size-3.5" />
            {t.prices.refresh}
          </Button>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <PriceSkeleton label={t.prices.loading} />
      ) : null}

      {state.status === "error" ? (
        <div className="border-warning/40 bg-warning-soft flex items-start gap-2.5 rounded-xl border px-4 py-3.5 text-sm">
          <TriangleAlertIcon className="text-warning mt-0.5 size-4 shrink-0" />
          <span className="flex flex-col items-start gap-2">
            <span>{t.prices.error}</span>
            <Button variant="outline" size="sm" onClick={reload}>
              {t.prices.retry}
            </Button>
          </span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.lines.map((line) => (
              <li
                key={line.id}
                className="bg-card flex items-center gap-3.5 rounded-xl border p-4"
              >
                <span
                  aria-hidden
                  className="bg-secondary flex size-11 shrink-0 items-center justify-center rounded-lg text-xl"
                >
                  {line.emoji}
                </span>

                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-medium">{line.nameEn}</span>
                  <span lang="ta" className="text-faint truncate text-xs">
                    {line.nameTa}
                  </span>
                  <span className="text-muted-foreground mt-1 text-xs">
                    {line.mandiRange
                      ? fill(t.prices.mandi, { range: line.mandiRange })
                      : t.prices.noMandi}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular leading-none font-semibold">
                    {line.price}
                    <span className="text-muted-foreground text-xs font-normal">
                      /{line.unit}
                    </span>
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", FRESHNESS_STYLE[line.freshness])}
                  >
                    {freshnessLabel[line.freshness]}
                  </Badge>
                  <span className="text-faint tabular text-[11px]">
                    {line.sources}{" "}
                    {line.sources === 1 ? t.prices.location : t.prices.locations}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="text-faint text-xs">{t.prices.disclaimer}</p>
        </>
      ) : null}
    </div>
  );
}

function PriceSkeleton({ label }: { label: string }) {
  return (
    <ul
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <li
          key={index}
          className="bg-card flex items-center gap-3.5 rounded-xl border p-4"
        >
          <Skeleton className="size-11 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-3 w-28" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </div>
        </li>
      ))}
    </ul>
  );
}
