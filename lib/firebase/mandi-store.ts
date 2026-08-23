import "server-only";

import { cache } from "react";

import { tickerQuotes, type MandiQuote } from "@/lib/domain/mandi";
import { adminDb, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * The cached mandi rates the ticker reads.
 *
 * One document per state rather than one per quote. The ticker is on every
 * page of the public site and inside every console, so the read has to be a
 * single small document — a query returning a few hundred rows on every render
 * would put a Firestore round trip from `nam5` in front of the landing page,
 * which is about 1.3 seconds from India before anything is drawn.
 *
 * Written once a day by `/api/cron/mandi-rates` and read everywhere else.
 * Nothing on a request path ever calls `data.gov.in`.
 */

const COLLECTION = "marketRates";

interface StoredQuote {
  cropId: string;
  commodity: string;
  market: string;
  district: string;
  state: string;
  low: number;
  high: number;
  modal: number;
  unit: string;
  asOf: string;
}

function toStored(quote: MandiQuote): StoredQuote {
  return { ...quote, asOf: quote.asOf.toISOString() };
}

function fromStored(row: StoredQuote): MandiQuote {
  return { ...row, unit: row.unit as MandiQuote["unit"], asOf: new Date(row.asOf) };
}

export async function writeStateRates(
  state: string,
  quotes: readonly MandiQuote[],
  now: Date,
): Promise<void> {
  if (!hasAdminCredentials()) return;

  await adminDb()
    .collection(COLLECTION)
    .doc(stateKey(state))
    .set({
      state,
      updatedAt: now,
      /*
        Only what a ticker shows — freshest per crop, stale dropped.

        Storing every row would be a document of several hundred entries read
        on every page load to render ten. The full set is Agmarknet's to keep;
        what this holds is the answer to one question.
      */
      quotes: tickerQuotes(quotes, now.getTime()).map(toStored),
    });
}

/** Lower-cased and hyphenated, so "Tamil Nadu" is a stable document id. */
export function stateKey(state: string): string {
  return state.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Rates for one state, or nothing at all.
 *
 * Never throws and never invents. A state nobody has fetched yet, a
 * deployment with no credentials and a Firestore that is down all yield an
 * empty list — and the ticker renders nothing rather than a stale figure or a
 * broken page.
 */
export const readStateRates = cache(async function readStateRates(
  state: string,
): Promise<MandiQuote[]> {
  if (!state || !hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb().collection(COLLECTION).doc(stateKey(state)).get();
    if (!snapshot.exists) return [];

    const rows = snapshot.data()?.quotes;
    if (!Array.isArray(rows)) return [];

    return rows.map((row) => fromStored(row as StoredQuote));
  } catch {
    return [];
  }
});
