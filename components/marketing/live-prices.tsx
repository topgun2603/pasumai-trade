"use client";

import { FlaskConicalIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { PriceLine } from "@/app/api/market/prices/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const FRESHNESS_STYLE: Record<PriceLine["freshness"], string> = {
  fresh: "border-success/40 bg-success-soft text-success",
  useSoon: "border-warning/40 bg-warning-soft text-warning",
  endOfLife: "border-destructive/40 bg-destructive-soft text-destructive",
};

type State =
  | { status: "loading" }
  | { status: "ready"; lines: PriceLine[]; asOf: string; liveCount: number }
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
export function LivePrices({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `/api/market/prices?locale=${encodeURIComponent(locale)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as {
          asOf: string;
          liveCount: number;
          lines: PriceLine[];
        };
        if (!cancelled) {
          setState({
            status: "ready",
            lines: data.lines,
            asOf: data.asOf,
            liveCount: data.liveCount,
          });
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
    // `locale` is a dependency, not just an argument: switching language has to
    // re-ask for the names, or the cards keep the ones fetched on first render.
  }, [reloadKey, locale]);

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

      {/*
        A skeleton, not the loader: nine cards are coming and their shape is
        known, so the page can hold still for them. The loader is for the
        calls somebody presses a button to make.
      */}
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

      {state.status === "ready" && state.liveCount < state.lines.length ? (
        /*
          Said once at the top and again on every card it applies to. A reader
          who scrolls straight to a figure never passes this line, and a reader
          who does should not have to hold "some of these" in their head while
          they scan nine cards.
        */
        <p className="border-border bg-secondary text-muted-foreground flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs">
          <FlaskConicalIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {state.liveCount === 0
              ? t.prices.allIllustrative
              : fill(t.prices.someIllustrative, {
                  count: String(state.lines.length - state.liveCount),
                })}
          </span>
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.lines.map((line) => (
              <li
                key={line.id}
                className={cn(
                  "group bg-card relative flex items-center gap-3.5 rounded-xl border p-4 transition-colors",
                  // A sample is drawn differently, not merely labelled. Two
                  // cards that look identical are two cards a reader treats
                  // identically, whatever the small print on one of them says.
                  line.illustrative
                    ? "cursor-not-allowed border-dashed bg-transparent"
                    : "hover:border-primary focus-within:border-primary",
                )}
              >
                {/*
                  A real price is something you can act on, so the card is a
                  way in. A stretched link rather than wrapping the card:
                  everything inside stays plain markup, and one link is one tab
                  stop instead of four.

                  It lands on the sign-in page rather than choosing a role
                  here. Buyer and franchise both bid, that page is built to
                  switch between them, and a card offering two destinations is
                  a card that needs a decision before it can be clicked.
                */}
                {line.illustrative ? null : (
                  <Link
                    href={`/${locale}/signin?as=buyer`}
                    className="focus-visible:ring-ring absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="sr-only">
                      {fill(t.prices.bidOn, { crop: line.name })}
                    </span>
                  </Link>
                )}
                <span
                  aria-hidden
                  className="bg-secondary flex size-11 shrink-0 items-center justify-center rounded-lg text-xl"
                >
                  {line.emoji}
                </span>

                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  {/*
                    One name, in the language the reader chose.

                    This was the English name with the Tamil beneath it, on
                    every card in all six languages — so a Telugu reader got a
                    Telugu heading over cards naming the crop twice, in neither
                    of the languages they were reading. The server now resolves
                    the name for the locale and sends one string.
                  */}
                  <span className="truncate font-medium">{line.name}</span>
                  {/*
                    The sub-line says what the figure is, and swaps on hover to
                    say what you can do about it. Stacked in one grid cell so
                    the swap costs no height — a card that grows under the
                    pointer shoves the two beside it, and in a nine-card grid
                    that is the whole section moving.

                    Both lines stay in the DOM. On a phone there is no hover at
                    all, so the informative line is simply the one that shows,
                    and the card is still tappable through the stretched link.
                  */}
                  <span className="mt-1 grid text-xs">
                    <span
                      className={cn(
                        "text-muted-foreground col-start-1 row-start-1 truncate transition-opacity",
                        "group-hover:opacity-0 group-focus-within:opacity-0",
                      )}
                    >
                      {line.illustrative
                        ? t.prices.example
                        : line.settledCount > 1
                          ? fill(t.prices.sources, { count: String(line.settledCount) })
                          : t.prices.noSettled}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "col-start-1 row-start-1 truncate opacity-0 transition-opacity",
                        "group-hover:opacity-100 group-focus-within:opacity-100",
                        line.illustrative ? "text-faint" : "text-primary",
                      )}
                    >
                      {line.illustrative ? t.prices.notAvailable : t.prices.signInToBid}
                    </span>
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
                  {/* A count of villages is a claim about the platform, so it
                      is not made on a card that is only an illustration. */}
                  {line.illustrative ? null : (
                    <span className="text-faint tabular text-[11px]">
                      {line.sources}{" "}
                      {line.sources === 1 ? t.prices.location : t.prices.locations}
                    </span>
                  )}
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
