import { MandiTicker } from "@/components/market/mandi-ticker";
import { readStateRates } from "@/lib/firebase/mandi-store";

/**
 * The mandi ticker, ready to drop into any layout.
 *
 * Every surface wants the same thing — read the cached rates, render them,
 * show nothing if there are none — and doing that in five layouts is four
 * chances to get the empty case wrong. The read is memoised per request, so
 * two of these on one page cost one lookup.
 *
 * `state` is what scopes it: a farmer in Tamil Nadu sees Tamil Nadu's markets.
 * The public site has nobody to ask, so it takes the default.
 */

/**
 * Where the platform started and where most listings still are.
 *
 * Used for the public site, which has no signed-in person to take a state
 * from. Worth revisiting the day a visitor's own state can be guessed — a
 * Kerala buyer reading Tamil Nadu rates is not wrong, just less useful.
 */
export const DEFAULT_TICKER_STATE = "Tamil Nadu";

export async function TickerSlot({
  state = DEFAULT_TICKER_STATE,
  locale = "en",
  label,
}: {
  state?: string;
  locale?: string;
  label?: string;
}) {
  const quotes = await readStateRates(state);

  return (
    <MandiTicker
      quotes={quotes}
      locale={locale}
      // Read here rather than inside the ticker so both copies of the track
      // agree, and so the relative ages do not shift between server and client.
      now={new Date().getTime()}
      label={label}
    />
  );
}
