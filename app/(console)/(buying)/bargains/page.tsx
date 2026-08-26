import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { LiveBargains } from "@/components/negotiation/live-bargains";
import { PageHeader } from "@/components/page-header";
import { lotBooks } from "@/lib/domain/lot-book";
import { consoleLocale } from "@/lib/i18n/console";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { readLots } from "@/lib/firebase/remaining-read";
import { negotiations } from "@/lib/mock/negotiations";
import { isBuyingRole } from "@/lib/auth/claims";
import { verifySession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bargains · Pasumai Trade" };

export default async function BargainsPage() {
  await connection();

  // One clock, read on the server and handed down, so the countdowns render
  // identically either side of hydration.
  const now = new Date().getTime();

  /*
    Both reads hit Firestore; neither depends on the other.

    There was a third — the whole controls catalogue — read for one number,
    the proposal expiry window. Proposals no longer expire, so the round trip
    went with it.
  */
  // Reads the language cookie rather than the database, so it costs nothing
  // and somebody who has just switched sees it on this render.
  const locale = await consoleLocale();

  const [{ threads, live }, { vocabulary }] = await Promise.all([
    readNegotiations(negotiations(now)),
    // The same list the farmer's side gets and the same list the endpoint
    // checks against — see lib/firebase/bargain-vocabulary-read.ts.
    readBargainVocabulary(),
  ]);

  // What is unsold on each lot under negotiation, so a buyer bidding for part
  // of one cannot ask for more than is left. Read per listing, and only for the
  // listings actually being bargained over.
  const lots = await readLots(threads.map((t) => t.listingId));
  const remaining = Object.fromEntries(
    Object.entries(lots).map(([id, lot]) => [id, lot.remaining]),
  );

  // Operations can read a bargain but never speak in one, which is the same
  // rule the endpoint enforces.
  const session = await verifySession();
  const editable =
    live && session !== null && isBuyingRole(session.claims.role);

  /*
    How much of each lot is gone, and how much of it other buyers are chasing.
    Against the lot as posted — the book subtracts the sales itself.

    Needs the session, so it comes after it: `viewerBuyerId` is what splits
    "your bid" out of the demand, and getting it from anywhere but the session
    would let a request nominate whose bids to highlight.

    Aggregate only. `LotBook` carries no rates, so what a rival is paying never
    leaves the server; how much they want is market depth and belongs to both
    sides of a trade.
  */
  const books = lotBooks({
    listings: Object.entries(lots).map(([id, lot]) => ({ id, grades: lot.posted })),
    threads,
    viewerBuyerId: session?.claims.accountId,
  });

  /*
    Only this account's bargains cross to the browser.

    Everything above reads every thread on the platform, because that is what
    the lot book is built from — but the book is aggregate, and this is not. A
    thread carries the other side's rates, so handing the whole collection to a
    buyer's page put every competitor's price one View Source away. It also
    disagreed with the stream, which has always scoped by `buyerId`: the first
    paint showed rivals' threads and the first live update swept them away.

    Operations keep the full view. They may read a bargain and never speak in
    one, and reading them is the job.
  */
  const isOperations = session?.claims.role === "admin";
  const visible = isOperations
    ? threads
    : threads.filter((t) => t.buyerId === session?.claims.accountId);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Bargains"
        description="Settle a price with the farmer before the vehicle is committed. Bid on one grade or several — grading happens at the farm gate, and a grade priced now is a grade nobody reopens there."
      />

      {editable ? null : (
        <div className="border-warning/40 bg-warning-soft text-warning m-6 flex items-start gap-3 rounded-lg border p-4">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Read only</span>
            <span className="text-foreground/80">
              {live
                ? "Sending is disabled in production until the console is behind authentication. The endpoint takes the sender from the request, so without a session anyone could accept a price on the farmer's behalf."
                : "Showing sample threads: no Admin credentials, or nothing seeded yet. Run npm run seed to bargain against real data."}
            </span>
          </div>
        </div>
      )}

      <LiveBargains
        initial={visible}
        viewer="buyer"
        locale={locale}
        now={now}
        vocabulary={vocabulary}
        remaining={remaining}
        books={books}
        editable={editable}
      />
    </div>
  );
}
