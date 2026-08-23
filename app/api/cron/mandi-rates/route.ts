import { configured, fetchStateRates } from "@/lib/agmarknet/rates";
import { hasAdminCredentials } from "@/lib/firebase/admin";
import { writeStateRates } from "@/lib/firebase/mandi-store";

/**
 * The daily pull of mandi rates.
 *
 * Same shape as the renewal reminders: a GET with no body, guarded by a shared
 * secret rather than a session, because a cron has no user to be. An absent
 * secret fails closed — an open endpoint here would let a stranger burn the
 * platform's `data.gov.in` quota for the day, which is a denial of service
 * that costs nothing to mount.
 *
 * Safe to run more often than scheduled. Each state's document is rewritten
 * whole, so a retry, an overlap or an operator pressing the button twice
 * produces the same result as running it once.
 *
 * ## Why the states are a fixed list
 *
 * One request per state, and the platform reads a handful. Pulling every state
 * in India daily would be thirty-six requests against a per-key rate limit for
 * rates nobody is looking at — so this covers where there are farmers, and
 * grows when the platform does.
 */

export const dynamic = "force-dynamic";

/** Where the platform actually has listings. Add to this as it opens up. */
const STATES = ["Tamil Nadu", "Karnataka", "Andhra Pradesh", "Kerala", "Maharashtra"];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  const offered = request.headers.get("authorization") ?? "";
  if (offered !== `Bearer ${secret}`) {
    return Response.json({ error: "Not for you." }, { status: 401 });
  }

  if (!hasAdminCredentials()) {
    return Response.json({ error: "No database credentials." }, { status: 503 });
  }

  /*
    Said out loud rather than returning an empty success.

    Without a key this job fetches nothing, and a 200 with no rates reads as
    "the mandis were quiet today" — which is a different fact and would leave
    the ticker blank with nobody knowing why.
  */
  if (!configured()) {
    return Response.json(
      {
        error: "DATA_GOV_IN_API_KEY is not set, so no rates can be fetched.",
        code: "unconfigured",
      },
      { status: 503 },
    );
  }

  const now = new Date();
  const results: Array<{ state: string; quotes?: number; of?: number; error?: string }> = [];

  for (const state of STATES) {
    const result = await fetchStateRates(state);

    if (!result.ok) {
      // One state failing does not stop the rest. A silent Agmarknet in
      // Kerala is not a reason to leave Tamil Nadu's rates a day old.
      results.push({ state, error: result.reason });
      continue;
    }

    await writeStateRates(state, result.quotes, now);
    results.push({ state, quotes: result.quotes.length, of: result.fetched });
  }

  return Response.json({ at: now.toISOString(), states: results });
}
