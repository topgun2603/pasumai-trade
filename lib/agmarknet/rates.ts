import "server-only";

import type { QuantityUnit } from "@/lib/domain/enums";
import {
  arrivalDateParam,
  readQuote,
  type AgmarknetRecord,
  type MandiQuote,
} from "@/lib/domain/mandi";

/**
 * Pulling mandi rates off the Government of India's open-data platform.
 *
 * The feed is Agmarknet's, republished on `data.gov.in` — the Ministry of
 * Agriculture's own record of what regulated markets paid, and the only
 * reference price on this platform that is not our own arithmetic.
 *
 * ## The date filter is not optional
 *
 * The resource holds **eighty-one million rows**, going back years, and it
 * returns them oldest first. A request without a date filter reads February
 * 2023 — plausible-looking prices from three years ago, on a ticker labelled
 * live. So every request names a day, and the caller walks backwards from
 * today until one answers.
 *
 * That walk is not a nicety. Mandis upload by hand, so the most recent day
 * with data is routinely yesterday and sometimes the day before, and asking
 * only for today would leave the ticker empty most mornings.
 *
 * ## Case
 *
 * Filters are `filters[State]`, `filters[District]`, `filters[Commodity]`,
 * `filters[Arrival_Date]`. The records come back keyed `State`, `District`,
 * `Market`, `Commodity`, `Arrival_Date`, `Min_Price`, `Max_Price`,
 * `Modal_Price`. Both taken from a live response rather than from the docs.
 *
 * ## It says when it cannot work
 *
 * No key, no rates — and it says so, rather than returning an empty list a
 * caller reads as "no mandi traded today". Same distinction
 * `lib/notify/channels.ts` draws for SMS, and for the same reason: a job that
 * silently succeeds at doing nothing is how a platform comes to believe it
 * showed farmers a price it never fetched.
 */

const ENDPOINT = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24";

/** Their per-request cap. Asking for more is truncated, so ask for this. */
const PAGE = 1000;

/**
 * How far back to look for a day that reported.
 *
 * Beyond this the figure has stopped being today's rate — `STALE_AFTER_DAYS`
 * in the domain would drop it anyway, so there is no point paying for the
 * request.
 */
const LOOK_BACK_DAYS = 5;

export type RatesResult =
  | {
      readonly ok: true;
      readonly quotes: MandiQuote[];
      /** Rows the endpoint returned, before mapping. */
      readonly fetched: number;
      /** Which day's data this is, once one was found. */
      readonly day: string | null;
    }
  | { readonly ok: false; readonly reason: "unconfigured" | "unreachable" | "refused" | "throttled" };

export function configured(): boolean {
  return Boolean(process.env.DATA_GOV_IN_API_KEY);
}

/** One request: one state, one day. */
async function fetchDay(
  key: string,
  state: string,
  day: string,
): Promise<{ ok: true; records: AgmarknetRecord[] } | { ok: false; reason: "unreachable" | "refused" | "throttled" }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("api-key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(PAGE));
  url.searchParams.set("filters[State]", state);
  url.searchParams.set("filters[Arrival_Date]", day);

  let response: Response;
  try {
    response = await fetch(url, {
      // The cron is the only caller and it wants today's, not a cached copy.
      cache: "no-store",
      // A slow government endpoint is ordinary; one that hangs would hold the
      // cron open until the platform's own timeout.
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  if (!response.ok) return { ok: false, reason: "refused" };

  let body: { records?: unknown; error?: unknown };
  try {
    body = (await response.json()) as { records?: unknown; error?: unknown };
  } catch {
    return { ok: false, reason: "refused" };
  }

  /*
    Their throttle answers 200 with `{"error":"Rate limit exceeded"}` and no
    records — which, read carelessly, is indistinguishable from a quiet day.
    Told apart here, because "we were throttled" and "no mandi traded" want
    different responses from whoever is reading the cron's output.
  */
  if (typeof body.error === "string") {
    return { ok: false, reason: /rate limit/i.test(body.error) ? "throttled" : "refused" };
  }

  return { ok: true, records: Array.isArray(body.records) ? body.records : [] };
}

/**
 * The most recent day of rates for one state.
 *
 * Scoped by state rather than district: one call covering Tamil Nadu costs the
 * same as one covering Erode, and the platform needs several districts —
 * filtering the result is free, each extra request is not.
 *
 * `unit` decides the conversion. A crop listed in crates yields nothing, which
 * `readQuote` handles.
 */
export async function fetchStateRates(
  state: string,
  unit: QuantityUnit = "kg",
  today: Date = new Date(),
): Promise<RatesResult> {
  const key = process.env.DATA_GOV_IN_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured" };

  for (let back = 0; back <= LOOK_BACK_DAYS; back += 1) {
    const day = arrivalDateParam(new Date(today.getTime() - back * 86_400_000));
    const result = await fetchDay(key, state, day);

    // A throttle is not "this day was quiet" — stop rather than walking five
    // more days into the same wall and reporting an empty state.
    if (!result.ok) {
      if (result.reason === "throttled") return { ok: false, reason: "throttled" };
      return { ok: false, reason: result.reason };
    }

    if (result.records.length === 0) continue;

    // Every row is checked and a bad one dropped — these are typed in by
    // market staff and arrive as strings. See `readQuote`.
    const quotes = result.records
      .map((row) => readQuote(row, unit))
      .filter((quote): quote is MandiQuote => quote !== null);

    return { ok: true, quotes, fetched: result.records.length, day };
  }

  // Every day in the window came back empty. Not a failure — that state has
  // reported nothing this week, which happens.
  return { ok: true, quotes: [], fetched: 0, day: null };
}
