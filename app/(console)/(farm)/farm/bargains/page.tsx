import { HandshakeIcon, LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { LiveBargains } from "@/components/negotiation/live-bargains";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireFarmer } from "@/lib/auth/farm";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
import { lotBooks } from "@/lib/domain/lot-book";
import { isReady, nextStep } from "@/lib/domain/readiness";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { readLots } from "@/lib/firebase/remaining-read";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Bargains · Farmer" };

/**
 * Live bargaining, as its own section.
 *
 * It lived in a panel that slid out from a listing, which read as a detail of
 * the produce rather than as the thing a farmer opens the app to do. It is the
 * same console the buyer uses, on the same footing, with `viewer="farmer"` —
 * one implementation of the rules seen from the other end, so the accept guard
 * cannot drift between the two.
 *
 * Open threads only. A settled bargain is a receipt and lives under Sales; a
 * live one is a decision with a clock on it, and mixing them means scrolling
 * past last month to answer this morning.
 */
export default async function FarmBargainsPage({
  searchParams,
}: {
  // Async in Next 16 — reading it opts this route into request-time rendering.
  searchParams: Promise<{ thread?: string }>;
}) {
  await connection();

  const [{ farmer, flags, journey }, { thread }] = await Promise.all([
    requireFarmer(),
    searchParams,
  ]);
  const clock = new Date().getTime();

  /*
    The controls catalogue used to be read here too, for one number: how long
    a proposal held. Proposals no longer expire, so that round trip is gone —
    which matters most on this page, read on a handset over a rural signal.
  */
  const [{ threads }, { vocabulary }] = await Promise.all([
    readNegotiations(negotiations(clock)),
    // What either side may say, as operations maintain it in Controls. Read on
    // the server so the picker and the write endpoint agree on the list.
    readBargainVocabulary(),
  ]);

  // Scoped by the session's farmer id. There is no path that takes one from
  // the URL — `thread` only chooses which of their own to open first.
  const mine = threads.filter((t) => t.farmerId === farmer.id && t.status === "open");

  // Each lot under negotiation, as posted and as it stands. One read per
  // listing, and only for listings with a live bargain on them.
  const lots = await readLots(mine.map((t) => t.listingId));

  // What is left, so a buyer bidding for part of a lot is bounded by what
  // nobody else has taken.
  const remaining = Object.fromEntries(
    Object.entries(lots).map(([id, lot]) => [id, lot.remaining]),
  );

  /*
    How much of each lot is sold and how many buyers are chasing the rest.
    Shown above the conversation because it is what decides the next move: a
    farmer holding out on this buyer is doing so on the strength of the other
    three.

    Against the lot *as posted*, not against what is left of it — the book
    subtracts the sales itself, so handing it the remainder would take them off
    twice and draw a field smaller than the one out there.
  */
  const books = lotBooks({
    listings: Object.entries(lots).map(([id, lot]) => ({ id, grades: lot.posted })),
    // Every bargain of this farmer's, settled included — the settled ones are
    // what "sold" means.
    threads: threads.filter((t) => t.farmerId === farmer.id),
  });

  const ready = isReady(flags);
  const blocking = nextStep(journey);

  return (
    <>
      <PageHeader
        title="Bargains"
        description="Buyers offer, you counter. Nothing is binding until one of you accepts."
        aside={
          <p className="text-faint text-xs">
            {mine.length} open · <Link href="/farm/sales" className="hover:underline">see sales</Link>
          </p>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        {!ready ? (
          <div className="border-warning/30 bg-warning-soft flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <LockIcon className="size-4 shrink-0" />
              {flags.awaitingReview
                ? "You can read every bargain. Replying opens when your verification clears."
                : blocking?.id === "verify"
                  ? "You can read every bargain. Replying needs your account verified."
                  : "You can read every bargain. Replying and accepting need a plan."}
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={blocking?.href ?? "/farm/verification"}>
                {blocking?.id === "verify" ? "Verify" : "See plans"}
              </Link>
            </Button>
          </div>
        ) : null}

        {mine.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
            <HandshakeIcon className="size-7" />
            <p className="max-w-sm text-sm">
              No live bargains. When a buyer offers on your produce, the conversation appears here.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/farm/sales">See what has sold</Link>
            </Button>
          </div>
        ) : (
          <LiveBargains
            initial={mine}
            // Open only, and the stream re-applies it: a bargain somebody
            // accepts while this is on screen belongs under Sales from that
            // moment, not in the live list.
            filter="open"
            viewer="farmer"
            now={clock}
                vocabulary={vocabulary}
            remaining={remaining}
            books={books}
            // Arriving from a listing opens that lot's bargain rather than
            // whichever happens to sort first.
            initialThreadId={thread}
            // Reading stays open; writing is gated. The server checks again and
            // answers 402 — this only decides whether the composer is live.
            editable={ready}
          />
        )}
      </div>
    </>
  );
}
