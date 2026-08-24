"use client";

import { ChevronLeftIcon, ChevronRightIcon, HandshakeIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  phraseById,
  type VocabularyEntry,
} from "@/lib/domain/bargain-vocabulary";
import { GRADES, GRADE_LABELS, unitLabel } from "@/lib/domain/enums";
import { formatRate, money } from "@/lib/domain/money";
import {
  PARTY_LABELS,
  rateFor,
  type Negotiation,
  type NegotiationMessage,
  type Party,
} from "@/lib/domain/negotiation";
import { formatQuantity } from "@/lib/domain/quantity";
import { relativeTime, shortDate } from "@/lib/format";
import { LOCALE_META, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * A finished bargain, in full — everything both sides said and every price
 * either of them named.
 *
 * ## Why the whole thread and not the outcome
 *
 * A settled rate on its own answers "what did I get". It does not answer the
 * question somebody actually comes back with, which is "why did I agree to
 * that" — and on this platform the answer is always in the exchange: what was
 * asked, what was offered, who moved, how far, and what was said about grading
 * or collection along the way. The thread is the commercial record. Showing
 * only its last line throws away the part that settles an argument.
 *
 * ## Read in the reader's own language
 *
 * Messages are stored as phrase ids, not as words either side typed, so the
 * same exchange renders in Tamil for the farmer and English for the buyer off
 * one record. A phrase since retired from the vocabulary falls back to the
 * English text denormalised on the message, which is why that field exists.
 *
 * ## No controls
 *
 * Nothing here is actionable. A live thread is under Bargains, with the
 * buttons; this is the record of one that is over, and a record you can act on
 * is a work queue wearing a different name.
 */

function reading(
  message: NegotiationMessage,
  locale: string,
  vocabulary: readonly VocabularyEntry[],
): { text: string; tag: string } | null {
  const phrase = message.phraseId ? phraseById(vocabulary, message.phraseId) : undefined;

  if (phrase) {
    const translated = phrase.text[locale];
    return {
      text: translated ?? phrase.text.en,
      tag: translated && locale in LOCALE_META ? LOCALE_META[locale as Locale].tag : "en-IN",
    };
  }

  if (!message.text) return null;

  const written = message.locale;
  return {
    text: message.text,
    tag: written && written in LOCALE_META ? LOCALE_META[written as Locale].tag : "en-IN",
  };
}

const STATUS: Record<string, { label: string; className: string }> = {
  agreed: { label: "Agreed", className: "border-success/40 bg-success-soft text-success" },
  withdrawn: { label: "Ended", className: "border-border text-muted-foreground" },
  expired: { label: "Expired", className: "border-border text-muted-foreground" },
  open: { label: "Open", className: "border-warning/40 bg-warning-soft text-warning" },
};

/** The rates a message named, as one line. */
function bandLine(
  message: NegotiationMessage,
  unit: string,
  locale: string,
): string | null {
  // Both halves in the reader's language. The rate said "/kg" beside a
  // quantity that said "கிலோ", which is one line contradicting itself.
  const said = unitLabel(unit as never, locale);
  const priced = GRADES.filter((g) => rateFor(message.bands ?? [], g) !== undefined);
  if (priced.length === 0) return null;

  return priced
    .map((grade) => {
      const rate = rateFor(message.bands ?? [], grade)!;
      const qty = message.bands?.find((b) => b.grade === grade)?.quantity;
      const price = formatRate(money(rate), said);
      return qty === undefined
        ? `${GRADE_LABELS[grade]} ${price}`
        : `${GRADE_LABELS[grade]} ${price} × ${formatQuantity(qty, unit, locale)}`;
    })
    .join(" · ");
}

export function BargainTranscript({
  threads,
  viewer,
  vocabulary,
  locale = "en",
  now,
}: {
  /** Finished threads, newest first. */
  threads: readonly Negotiation[];
  /** Which side of these bargains the reader was on. */
  viewer: Party;
  vocabulary: readonly VocabularyEntry[];
  locale?: string;
  now: number;
}) {
  const [page, setPage] = useState(0);

  /*
    Five to a page. A bargain here is a whole conversation rather than a row,
    so a page of twenty is a wall — and the reason somebody opens this is
    usually to find one particular exchange, which is scrolling either way.
  */
  const PER_PAGE = 5;
  const pages = Math.max(1, Math.ceil(threads.length / PER_PAGE));
  // Clamped rather than stored: the list can shrink under a reader who has
  // paged to the end, and an out-of-range page renders nothing at all.
  const current = Math.min(page, pages - 1);
  const shown = threads.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={HandshakeIcon}
        tone="done"
        title="No finished bargains yet"
        description="When a bargain is agreed or closed it moves here in full — every message and every price either side named."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {shown.map((thread) => {
        const status = STATUS[thread.status] ?? STATUS.open;
        const other = viewer === "farmer" ? thread.buyerName : thread.farmerName;

        /*
          What the farmer opened at, in the heading beside what it settled at.

          The *first* price they named, not their latest — the pair only means
          anything if one end of it is where the bargaining started. Reading
          "asked ₹25, settled ₹23.50" is the whole story of a thread in one
          line, and it is the line somebody scans a page of these for.
        */
        const asking = bandLine(
          thread.messages.find(
            (message) => message.author === "farmer" && message.kind === "proposal",
          ) ?? ({} as NegotiationMessage),
          thread.unit,
          locale,
        );
        const agreed = thread.agreedBands
          ? bandLine(
              { bands: thread.agreedBands } as NegotiationMessage,
              thread.unit,
              locale,
            )
          : null;

        return (
          <article
            key={thread.id}
            className="border-border bg-card flex flex-col overflow-hidden rounded-lg border"
          >
            <header className="bg-muted/40 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-3">
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                  <span>
                    {thread.produceName} ·{" "}
                    {formatQuantity(thread.quantity, thread.unit, locale)}
                  </span>
                  {asking ? (
                    /*
                      Weighted to be read, not to sit politely beside the crop
                      name. It was muted grey at eleven pixels, which is how you
                      style something a reader is meant to skip — and this is
                      the figure the whole card exists to be compared against.

                      Carries the platform's own accent, so it reads as a pair
                      with the settled price in the footer rather than as two
                      unrelated numbers.
                    */
                    <span className="border-primary/25 bg-primary/10 text-primary tabular rounded-md border px-2 py-0.5 text-xs font-semibold">
                      asked {asking}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs">
                  {PARTY_LABELS[viewer === "farmer" ? "buyer" : "farmer"]}: {other}
                  {" · "}
                  {thread.messages.length} message
                  {thread.messages.length === 1 ? "" : "s"}
                </span>
              </div>
              <Badge variant="outline" className={cn("shrink-0", status.className)}>
                {status.label}
              </Badge>
            </header>

            {/* The exchange, oldest first — a bargain read backwards is not a
              bargain. */}
            <ol className="divide-border flex flex-col divide-y">
              {thread.messages.map((message) => {
                const said = reading(message, locale, vocabulary);
                const bands = bandLine(message, thread.unit, locale);
                const mine = message.author === viewer;

                return (
                  <li
                    key={message.id}
                    className={cn(
                      "flex flex-col gap-1 px-4 py-2.5",
                      mine ? "bg-primary/[0.04]" : undefined,
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-xs font-medium">
                        {mine ? "You" : PARTY_LABELS[message.author]}
                        {message.kind === "accept" ? (
                          <span className="text-success"> · accepted</span>
                        ) : message.kind === "withdraw" ? (
                          <span className="text-muted-foreground"> · walked away</span>
                        ) : null}
                      </span>
                      <time
                        dateTime={message.sentAt.toISOString()}
                        title={message.sentAt.toLocaleString("en-IN")}
                        className="text-faint shrink-0 text-xs"
                      >
                        {relativeTime(message.sentAt, now)}
                      </time>
                    </div>

                    {said ? (
                      <p lang={said.tag} className="text-sm">
                        {said.text}
                      </p>
                    ) : null}

                    {bands ? (
                      <p className="tabular text-muted-foreground text-xs">{bands}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {agreed ? (
              <footer className="border-success/30 bg-success-soft text-success flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t px-4 py-2.5">
                <span className="tabular text-sm font-medium">Settled at {agreed}</span>
                {thread.agreedAt ? (
                  <span className="text-xs opacity-80">{shortDate(thread.agreedAt)}</span>
                ) : null}
              </footer>
            ) : null}
          </article>
        );
      })}

      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-muted-foreground tabular text-sm">
            {threads.length} finished bargain{threads.length === 1 ? "" : "s"}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground tabular text-sm">
              Page {current + 1} of {pages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
