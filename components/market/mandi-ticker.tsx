import { TrendingUpIcon } from "lucide-react";

import { formatRate, money } from "@/lib/domain/money";
import { unitLabel } from "@/lib/domain/enums";
import { daysOld, type MandiQuote } from "@/lib/domain/mandi";
import { produceName } from "@/lib/domain/models";
import { CATALOGUE } from "@/lib/mock/catalogue";

/**
 * Today's mandi rates, scrolling.
 *
 * ## What it is showing, and what it is not
 *
 * These are Agmarknet's figures — what regulated markets reported paying — and
 * they are **not** prices on this platform. That distinction is the whole
 * reason the platform exists: nobody here publishes a rate, a farmer names one
 * and a buyer counters. So the ticker is labelled with the market it came from
 * and the day it was reported, and it never appears beside a platform average
 * dressed as the same kind of number.
 *
 * The figure quoted is Agmarknet's **modal** price — where the volume was, not
 * the midpoint of the day's range. A midpoint is a price nothing traded at.
 *
 * ## Rendered on the server
 *
 * No fetching, no client state, no polling. The rates are written once a day
 * by the cron and read from one cached document, so this costs the page a
 * property access. A ticker that opened a connection on every page of a public
 * site would be a self-inflicted load test.
 *
 * ## Why the list is duplicated
 *
 * The track holds two copies and slides by exactly half its width, which makes
 * the loop seamless without measuring anything. The second copy is marked and
 * hidden from assistive technology, so a screen reader meets each price once.
 */
export function MandiTicker({
  quotes,
  locale = "en",
  now,
  label = "Mandi rates",
}: {
  quotes: readonly MandiQuote[];
  locale?: string;
  /** From the server, so "2 days ago" is the same before and after hydration. */
  now: number;
  label?: string;
}) {
  // Nothing to say is said by saying nothing. An empty bar with a heading
  // would claim the mandis were quiet, which is a different fact from our not
  // having fetched them.
  if (quotes.length === 0) return null;

  const items = quotes.map((quote) => {
    const crop = CATALOGUE[quote.cropId];
    const age = daysOld(quote, now);

    return {
      key: `${quote.cropId}-${quote.market}`,
      name: crop ? produceName(crop, locale) : quote.commodity,
      emoji: crop?.emoji ?? "",
      rate: formatRate(money(quote.modal), unitLabel(quote.unit, locale)),
      where: quote.market || quote.district,
      // Said only when it is not today's. A date on every entry is noise; a
      // date on a stale one is the point.
      when: age <= 0 ? null : age === 1 ? "yesterday" : `${age} days ago`,
    };
  });

  /*
    Paced by how much there is rather than fixed, so six crops do not crawl and
    twenty do not race. Roughly five seconds of reading per entry.
  */
  const seconds = Math.max(30, items.length * 5);

  return (
    <aside
      aria-label={label}
      className="pasumai-ticker bg-rail text-rail-foreground border-rail-hover relative flex items-center gap-3 overflow-hidden border-y py-1.5"
      style={{ ["--ticker-duration" as string]: `${seconds}s` }}
    >
      {/* Anchored above the moving track so the reader always knows what these
          numbers are, even mid-scroll. */}
      <span className="bg-rail border-rail-hover z-10 flex shrink-0 items-center gap-1.5 border-r py-0.5 pr-3 pl-4 text-[11px] font-medium tracking-wide uppercase">
        <TrendingUpIcon className="size-3.5" />
        {label}
      </span>

      <div className="pasumai-ticker-track flex w-max items-center gap-8 pr-8">
        {[false, true].map((duplicate) => (
          <div
            key={String(duplicate)}
            data-ticker-copy={duplicate ? "true" : undefined}
            // The duplicate exists to make the loop seamless and has nothing to
            // add to a screen reader, which would otherwise read every rate
            // twice.
            aria-hidden={duplicate || undefined}
            className="flex items-center gap-8"
          >
            {items.map((item) => (
              <span
                key={item.key}
                className="flex items-baseline gap-1.5 text-xs whitespace-nowrap"
              >
                <span aria-hidden>{item.emoji}</span>
                <span className="font-medium">{item.name}</span>
                <span className="tabular font-semibold">{item.rate}</span>
                <span className="opacity-70">
                  {item.where}
                  {item.when ? ` · ${item.when}` : ""}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
