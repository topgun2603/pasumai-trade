import "server-only";

import type { QuantityUnit } from "@/lib/domain/enums";
import { readQuote, type MandiQuote } from "@/lib/domain/mandi";

/**
 * Pulling mandi rates off the Government of India's open-data platform.
 *
 * The feed is Agmarknet's, republished on `data.gov.in`. It is the Ministry of
 * Agriculture's own record of what was paid in regulated markets, which is the
 * only reference price on this platform that is not our own arithmetic.
 *
 * ## It says when it cannot work
 *
 * No key, no rates — and it says so, rather than returning an empty list that
 * a caller reads as "no mandi traded today". That distinction is the same one
 * `lib/notify/channels.ts` draws for SMS, and for the same reason: a job that
 * silently succeeds at doing nothing is how a platform comes to believe it
 * showed two hundred farmers a price it never fetched.
 *
 * ## What it does not do
 *
 * Retry, back off, or run on a request. The key is rate-limited per account,
 * and a ticker on every page of a public site would exhaust it inside an hour
 * — so this is called by the daily cron and everything else reads the cache.
 */

const ENDPOINT = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";

/** Their cap. Asking for more is silently truncated, so ask for exactly this. */
const PAGE = 1000;

export type RatesResult =
  | { readonly ok: true; readonly quotes: MandiQuote[]; readonly fetched: number }
  | { readonly ok: false; readonly reason: "unconfigured" | "unreachable" | "refused" }

export function configured(): boolean {
  return Boolean(process.env.DATA_GOV_IN_API_KEY);
}

/**
 * Every rate reported for one state on the most recent day they have.
 *
 * Scoped by state rather than by district, because one call covering Tamil
 * Nadu costs the same as one covering Erode and the platform needs several
 * districts — filtering the result is free, and each extra request is not.
 *
 * `unit` decides the conversion. Callers pass the unit the crop is listed in;
 * a crop listed in crates yields nothing, which `readQuote` handles.
 */
export async function fetchStateRates(
  state: string,
  unit: QuantityUnit = "kg",
): Promise<RatesResult> {
  const key = process.env.DATA_GOV_IN_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured" };

  const url = new URL(ENDPOINT);
  url.searchParams.set("api-key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(PAGE));
  // Only `state` takes the `.keyword` suffix. The others are plain, which is
  // not symmetrical and is not a typo.
  url.searchParams.set("filters[state.keyword]", state);

  let response: Response;
  try {
    response = await fetch(url, {
      // The cron is the only caller and it wants today's, not a cached copy.
      cache: "no-store",
      // A government endpoint that is slow is common; one that hangs would
      // hold the cron open until the platform's own timeout.
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  if (!response.ok) return { ok: false, reason: "refused" };

  let body: { records?: unknown };
  try {
    body = (await response.json()) as { records?: unknown };
  } catch {
    return { ok: false, reason: "refused" };
  }

  const records = Array.isArray(body.records) ? body.records : [];

  // Every row is checked and a bad one is dropped — see `readQuote`. These
  // are typed in by market staff and arrive as strings.
  const quotes = records
    .map((row) => readQuote(row as Record<string, unknown>, unit))
    .filter((quote): quote is MandiQuote => quote !== null);

  return { ok: true, quotes, fetched: records.length };
}
