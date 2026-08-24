"use client";

import {
  ArrowRightIcon,
  CheckIcon,
  HandshakeIcon,
  MessageSquareIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { relativeTime } from "@/lib/format";
import { GRADES, GRADE_LABELS, QUANTITY_UNITS, type Grade } from "@/lib/domain/enums";
import {
  phraseById,
  phrasesFor,
  TOPICS,
  TOPIC_LABELS,
  type VocabularyEntry,
} from "@/lib/domain/bargain-vocabulary";
import { EntityTag } from "@/components/entity-tag";
import { LotSplit } from "@/components/negotiation/lot-split";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import type { LotBook } from "@/lib/domain/lot-book";
import {
  formatQuantity,
  remaining as remainingOf,
} from "@/lib/domain/quantity";
import { formatMoney, formatRate, money } from "@/lib/domain/money";
import type { GradeBand } from "@/lib/domain/models";
import {
  canAccept,
  canPropose,
  gap,
  isPartial,
  isSettled,
  lastProposalBy,
  PARTY_LABELS,
  pricedGrades,
  quantityFor,
  rateFor,
  roundCount,
  standingProposal,
  valueAt,
  type Negotiation,
  type NegotiationMessage,
  type Party,
} from "@/lib/domain/negotiation";
import { LOCALE_META, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * A price bargain, as a thread.
 *
 * Two things make this different from a chat box with a number in it:
 *
 *  - A **proposal is a card, not a sentence.** Whichever grades it prices, and
 *    what the lot is worth at each, laid out the same way every time. A price
 *    buried in prose is a price that gets misread — and the farmer reading it
 *    may be doing so on a phone, in a field, in a second language.
 *
 *  - **The guards decide what is offered.** Accept and Send are enabled by the
 *    same domain functions the server enforces, and when they refuse, the
 *    reason is shown rather than the button silently doing nothing.
 *
 * `now` is passed in from the server so relative times render identically on
 * both sides of hydration.
 */

/**
 * What a message says, in the language of whoever is reading it.
 *
 * Resolved from the phrase id rather than shown as sent: a farmer wrote nothing
 * — they chose — so a buyer reads English and the farmer reads Tamil off the
 * same record. `text` is the fallback for threads written before the vocabulary
 * existed, and for a phrase since retired from the list.
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

/** The rates on offer, priced out against the actual quantity. */
function ProposalCard({
  negotiation,
  bands,
  tone,
}: {
  negotiation: Negotiation;
  bands: readonly GradeBand[];
  tone: "mine" | "theirs" | "agreed";
}) {
  const unitLabel = QUANTITY_UNITS[negotiation.unit].en;
  const partial = isPartial(negotiation, bands);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        tone === "agreed"
          ? "border-success/40 bg-success-soft"
          : tone === "mine"
            ? "border-primary/30 bg-background"
            : "border-border bg-background",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          {tone === "agreed" ? "Agreed" : "Proposed rates"}
          {partial ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] normal-case">
              Part of the lot
            </Badge>
          ) : null}
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {GRADES.map((grade) => {
          const rate = rateFor(bands, grade);
          if (rate === undefined) return null;
          const want = quantityFor(negotiation, bands, grade);
          return (
            <li key={grade} className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                Grade {GRADE_LABELS[grade]}
                <span className="tabular text-faint text-xs">
                  {want} {unitLabel}
                </span>
              </span>
              <span className="tabular flex items-baseline gap-2">
                <span className="font-medium">
                  {formatRate(money(rate), unitLabel)}
                </span>
                <span className="text-faint text-xs">
                  {formatMoney(valueAt(negotiation, bands, grade))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-faint text-xs">
        {partial
          ? "This is for part of the lot. What is not taken here stays on the market."
          : "Right-hand figure is the quantity at that rate. Grades not listed are not part of this offer."}
      </p>
    </div>
  );
}

function Bubble({
  negotiation,
  message,
  viewer,
  locale,
  vocabulary,
  now,
}: {
  negotiation: Negotiation;
  message: NegotiationMessage;
  viewer: Party;
  /** The reader's language, not the sender's. */
  locale: string;
  vocabulary: readonly VocabularyEntry[];
  now: number;
}) {
  const mine = message.author === viewer;
  const said = reading(message, locale, vocabulary);

  if (message.kind === "withdraw") {
    return (
      <li className="flex flex-col items-center gap-1 py-2">
        <span className="text-muted-foreground text-xs">
          {PARTY_LABELS[message.author]} ended this bargain ·{" "}
          {relativeTime(message.sentAt, now)}
        </span>
        {said ? (
          <p lang={said.tag} className="text-muted-foreground max-w-md text-center text-sm">
            {said.text}
          </p>
        ) : null}
      </li>
    );
  }

  return (
    <li className={cn("flex flex-col gap-1.5", mine ? "items-end" : "items-start")}>
      <span className="text-faint flex items-center gap-1.5 text-xs">
        {mine ? "You" : PARTY_LABELS[message.author]}
        <span aria-hidden>·</span>
        {relativeTime(message.sentAt, now)}
      </span>

      <div className={cn("flex max-w-md flex-col gap-2", mine && "items-end")}>
        {said ? (
          <p
            lang={said.tag}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              mine
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {said.text}
          </p>
        ) : null}

        {message.bands && message.kind !== "accept" ? (
          <ProposalCard
            negotiation={negotiation}
            bands={message.bands}
            tone={mine ? "mine" : "theirs"}
          />
        ) : null}

        {message.kind === "accept" ? (
          <div className="border-success/40 bg-success-soft text-success flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <HandshakeIcon className="size-4 shrink-0" />
            <span>
              {mine ? "You accepted" : `${PARTY_LABELS[message.author]} accepted`} these
              rates. The order is placed.
            </span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function BargainThread({
  negotiation,
  viewer,
  now,
  vocabulary,
  remaining,
  book,
  onSend,
  pending,
}: {
  negotiation: Negotiation;
  viewer: Party;
  now: number;
  /**
   * Everything either side may say, as operations maintain it in Controls.
   *
   * Passed down rather than imported, because it is stored data now — the
   * server reads it, the page hands it over, and the same list is what the
   * write endpoint checks against.
   */
  vocabulary: readonly VocabularyEntry[];
  /**
   * What is still unsold on this listing, per grade.
   *
   * Bounds the quantity fields, and is why a buyer sees "180 left" rather than
   * the 400 that was posted before somebody else took half. The server checks
   * it again against Firestore — this is so the person sees the limit while
   * they are typing, not after they press send.
   */
  remaining?: readonly GradeQuantity[];
  /**
   * Where the whole lot stands, not just this thread.
   *
   * Shown while bargaining because that is when it changes the decision: a
   * farmer holding out is doing so on the strength of the other three buyers,
   * and a buyer shaving a rupee should know two other people want the same
   * sack.
   */
  book?: LotBook;
  onSend: (draft: {
    kind: "note" | "proposal" | "accept" | "withdraw";
    phraseId?: string;
    bands?: GradeBand[];
  }) => Promise<boolean>;
  pending: boolean;
}) {
  const standing = standingProposal(negotiation);
  const theirs = standing && standing.author !== viewer ? standing : undefined;

  // Counter-offers open prefilled with what is on the table, so the buyer edits
  // a number rather than retyping three.
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const source = standing?.bands ?? [];
    return Object.fromEntries(
      GRADES.map((grade) => {
        const rate = rateFor(source, grade);
        return [grade, rate === undefined ? "" : String(rate / 100)];
      }),
    );
  });

  // Quantities, prefilled the same way. A blank field means the whole of what
  // is left at that grade, which is the ordinary case and should not need
  // typing.
  const [want, setWant] = useState<Record<string, string>>(() => {
    const source = standing?.bands ?? [];
    return Object.fromEntries(
      GRADES.map((grade) => {
        const q = source.find((b) => b.grade === grade)?.quantity;
        return [grade, q === undefined ? "" : String(q)];
      }),
    );
  });
  const [countering, setCountering] = useState(false);

  const settled = isSettled(negotiation);
  const acceptCheck = canAccept(negotiation, viewer);

  // The single grade on the table, where there is only one. Drives the accept
  // button's label, which used to name grade A whatever was actually offered.
  const offered = pricedGrades(theirs?.bands ?? []);
  const onlyOffered = offered.length === 1 ? offered[0] : undefined;

  /** How much is left at a grade, or the whole lot where nothing was passed. */
  const leftAt = (grade: Grade) =>
    remaining
      ? (remaining.find((r) => r.grade === grade)?.quantity ?? 0)
      : negotiation.quantity;

  // A blank rate means "not bidding on this grade", not "zero". Grades trade
  // separately, so leaving one out is an ordinary thing to do rather than an
  // incomplete form. A blank quantity means all of what is left at that grade.
  const proposed: GradeBand[] = GRADES.flatMap((grade) => {
    const entered = (draft[grade] ?? "").trim();
    if (entered === "") return [];

    const asked = (want[grade] ?? "").trim();
    return [
      {
        grade,
        ratePerUnit: Math.round(Number(entered) * 100),
        quantity: asked === "" ? leftAt(grade) : Math.round(Number(asked)),
      },
    ];
  });
  const proposeCheck = canPropose(negotiation, viewer, proposed, remaining);

  const distance = gap(negotiation);

  /*
    The two standing positions, whoever spoke last. Read from the thread rather
    than passed in: the thread *is* the record of what each side has said, and
    a second source for it is a second thing to keep in step.
  */
  const farmerAsk = lastProposalBy(negotiation, "farmer");
  const buyerBid = lastProposalBy(negotiation, "buyer");

  /*
    What the farmer opened at, for the header.

    The *first* price they named, not their latest — the header is the fixed
    reference the rest of the thread is read against, and it stops meaning
    anything if it moves every time somebody counters. The current positions
    are on the grade rows below, where they belong.
  */
  const farmerOpened = negotiation.messages.find(
    (message) => message.author === "farmer" && message.kind === "proposal",
  );

  /*
    Falls back to whoever spoke first.

    A buyer often opens the thread, so on a farmer's screen there is no asking
    price until they counter — and the header would carry a quantity and
    nothing else at exactly the moment they are deciding what to ask for. The
    opening offer is the number on the table then, and the label says which of
    the two it is rather than letting a buyer's bid read as an asking price.
  */
  const opening =
    farmerOpened ??
    negotiation.messages.find((message) => message.kind === "proposal");
  const openingLabel = farmerOpened ? "Asking" : "Opened at";
  const openingGrades = pricedGrades(opening?.bands ?? []);

  // Every grade anybody has priced or that has stock left — the union, so a
  // grade the buyer has bid on but the farmer has not priced still appears.
  const contextGrades = GRADES.filter(
    (grade) =>
      rateFor(farmerAsk?.bands ?? [], grade) !== undefined ||
      rateFor(buyerBid?.bands ?? [], grade) !== undefined ||
      (remaining?.some((r) => r.grade === grade) ?? false),
  );
  const gapGrades = GRADES.filter((g) => distance[g] !== undefined);
  const unitLabel = QUANTITY_UNITS[negotiation.unit].en;

  // A farmer reads their own language; the buyer console is English. Every
  // phrase exists in both, so the same message renders in whichever the reader
  // uses rather than in whichever the sender typed.
  const viewerLocale = viewer === "farmer" ? "ta" : "en";
  const sayable = phrasesFor(vocabulary, viewer);

  // The reason attached to walking away. Prefers the shipped "this does not
  // work for me", but takes any closing phrase, since operations can retire
  // either.
  const endPhrase =
    sayable.find((p) => p.id === "not-interested") ??
    sayable.find((p) => p.topic === "closing");

  async function send(
    kind: "note" | "proposal" | "accept" | "withdraw",
    extra: { phraseId?: string; bands?: GradeBand[] } = {},
  ) {
    const ok = await onSend({ kind, ...extra });
    if (ok) setCountering(false);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex flex-col leading-tight">
          <span className="font-medium">
            {negotiation.produceName} ·{" "}
            {/*
              Available against listed, not listed alone.

              Bug 8: the header said "400 kg" while another buyer had taken
              half of it, so the figure a farmer was bargaining over was the
              one that had stopped being true. `remaining` renders the pair
              only once some has gone.
            */}
            {book
              ? remainingOf(book.remaining, book.posted, negotiation.unit, viewerLocale)
              : formatQuantity(negotiation.quantity, negotiation.unit, viewerLocale)}
          </span>

          {/*
            The asking price, beside the crop rather than buried in the rows.

            The header carried the quantity alone, so the one figure every
            offer is judged against was the one thing not on screen while
            judging it.
          */}
          {openingGrades.length > 0 ? (
            <span className="tabular flex flex-wrap items-baseline gap-1.5 text-xs">
              <span className="text-faint">{openingLabel}</span>
              {openingGrades.map((grade) => (
                <span
                  key={grade}
                  className="border-primary/25 bg-primary/10 text-primary rounded-md border px-1.5 py-0.5 font-semibold"
                >
                  {GRADE_LABELS[grade]}{" "}
                  {formatRate(money(rateFor(opening!.bands ?? [], grade)!), unitLabel)}
                </span>
              ))}
            </span>
          ) : null}
          <span className="text-faint flex flex-wrap items-center gap-2 text-xs">
            <EntityTag
              kind={viewer === "buyer" ? "farmer" : "buyer"}
              name={viewer === "buyer" ? negotiation.farmerName : negotiation.buyerName}
              compact
            />
            <span>
              {roundCount(negotiation)} round
              {roundCount(negotiation) === 1 ? "" : "s"}
            </span>
          </span>
        </div>

        {settled ? (
          <Badge
            variant="outline"
            className={
              negotiation.status === "agreed"
                ? "border-success/40 bg-success-soft text-success"
                : "border-border text-muted-foreground"
            }
          >
            {negotiation.status === "agreed"
              ? "Agreed"
              : negotiation.status === "withdrawn"
                ? "Ended"
                : "Expired"}
          </Badge>
        ) : gapGrades.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-faint text-xs">Apart by</span>
            <span className="tabular flex gap-2 text-sm">
              {gapGrades.map((grade) => (
                <span key={grade} className="flex items-baseline gap-1">
                  <span className="text-faint text-xs">{GRADE_LABELS[grade]}</span>
                  {formatRate(money(distance[grade]!), unitLabel)}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </header>

      {book ? (
        <div className="bg-muted/30 border-b px-4 py-2">
          <LotSplit book={book} unit={unitLabel} you={viewer === "buyer"} compact />
        </div>
      ) : null}

      {/*
        Everything needed to judge the offer, on one row per grade.

        Bug 8: the thread showed the proposed rate and the selected quantity
        and nothing else, so deciding whether ₹22 was worth taking meant
        remembering what was asked, what is left, and what was posted. Three
        things a farmer is holding in their head in a field.
      */}
      {contextGrades.length > 0 ? (
        <dl className="divide-border bg-card divide-y border-b text-sm">
          {contextGrades.map((grade) => {
            const left = remaining?.find((r) => r.grade === grade)?.quantity;
            const asked = farmerAsk ? rateFor(farmerAsk.bands ?? [], grade) : undefined;
            const bid = buyerBid ? rateFor(buyerBid.bands ?? [], grade) : undefined;

            return (
              <div
                key={grade}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2"
              >
                <dt className="text-faint w-16 shrink-0 text-xs tracking-wide uppercase">
                  Grade {GRADE_LABELS[grade]}
                </dt>
                <dd className="tabular flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {left !== undefined ? (
                    <span className="text-muted-foreground text-xs">
                      {formatQuantity(left, negotiation.unit, viewerLocale)} left
                    </span>
                  ) : null}
                  {asked !== undefined ? (
                    <span className="text-xs">
                      <span className="text-faint">Asking </span>
                      {formatRate(money(asked), unitLabel)}
                    </span>
                  ) : null}
                  {bid !== undefined ? (
                    <span className="text-xs">
                      <span className="text-faint">Offered </span>
                      {formatRate(money(bid), unitLabel)}
                    </span>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      <ol className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {negotiation.messages.map((message) => (
          <Bubble
            key={message.id}
            negotiation={negotiation}
            message={message}
            viewer={viewer}
            locale={viewerLocale}
            vocabulary={vocabulary}
            now={now}
          />
        ))}
      </ol>

      {settled ? (
        <footer className="bg-muted/40 border-t p-4">
          {negotiation.status === "agreed" && negotiation.agreedBands ? (
            <ProposalCard
              negotiation={negotiation}
              bands={negotiation.agreedBands}
              tone="agreed"
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              This thread is closed and kept as the record of what was discussed.
            </p>
          )}
        </footer>
      ) : (
        <footer className="bg-muted/40 flex flex-col gap-3 border-t p-4">
          {theirs ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => send("accept")}
                disabled={pending || !acceptCheck.allowed}
                title={acceptCheck.allowed ? undefined : acceptCheck.refusal.message}
              >
                <CheckIcon className="size-4" />
                {/*
                  What was actually offered, not grade A. A buyer bidding on the
                  B grade alone used to be offered "Accept ₹0/kg / A" — a rate
                  nobody quoted, for a grade nobody mentioned, on the button
                  that binds the sale.

                  Named only when a single grade is on the table. Several rates
                  do not fit on a button, and the card directly above lists
                  every one of them.
                */}
                {onlyOffered
                  ? `Accept ${formatRate(
                      money(rateFor(theirs.bands ?? [], onlyOffered)!),
                      unitLabel,
                    )} for grade ${GRADE_LABELS[onlyOffered]}`
                  : "Accept these rates"}
              </Button>
              <Button variant="outline" onClick={() => setCountering((v) => !v)}>
                <ArrowRightIcon className="size-4" />
                Counter
              </Button>
              {!acceptCheck.allowed ? (
                <span className="text-warning text-xs">
                  {acceptCheck.refusal.message}
                </span>
              ) : null}
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCountering((v) => !v)}>
              <SendIcon className="size-4" />
              {lastProposalBy(negotiation, viewer) ? "Revise your rates" : "Send rates"}
            </Button>
          )}

          {countering ? (
            <div className="bg-background flex flex-col gap-3 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">
                Bid on one grade or several, for all of it or part. A grade left
                blank is not part of this offer; a quantity left blank is all
                that is left at that grade.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {GRADES.map((grade) => {
                  const left = leftAt(grade);
                  const sold = remaining !== undefined && left === 0;

                  return (
                    <div key={grade} className="flex flex-col gap-1.5">
                      <Label htmlFor={`rate-${grade}`} className="text-sm">
                        Grade {GRADE_LABELS[grade]}
                        <span className="text-faint text-xs font-normal">
                          {sold ? "sold out" : `${left} ${unitLabel} left`}
                        </span>
                      </Label>

                      <div className="flex items-center gap-1.5">
                        <Input
                          id={`rate-${grade}`}
                          inputMode="decimal"
                          disabled={sold}
                          placeholder={`₹ / ${unitLabel}`}
                          aria-label={`Grade ${GRADE_LABELS[grade]} rate in rupees per ${unitLabel}`}
                          value={draft[grade] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [grade]: e.target.value }))
                          }
                          className="tabular"
                        />
                        <span className="text-faint shrink-0 text-xs">×</span>
                        <Input
                          inputMode="numeric"
                          disabled={sold}
                          // Placeholder rather than a filled value: an empty
                          // field that means "all of it" reads as one decision,
                          // where a prefilled number reads as one to check.
                          placeholder={sold ? "—" : String(left)}
                          aria-label={`Grade ${GRADE_LABELS[grade]} quantity in ${unitLabel}`}
                          value={want[grade] ?? ""}
                          onChange={(e) =>
                            setWant((w) => ({ ...w, [grade]: e.target.value }))
                          }
                          className="tabular"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {!proposeCheck.allowed ? (
                <p className="text-destructive text-xs">
                  {proposeCheck.refusal.message}
                </p>
              ) : (
                <p className="text-faint text-xs">
                  {proposed.length === 0
                    ? "Leave a grade blank to skip it — but price at least one."
                    : proposed
                        .map(
                          (band) =>
                            `${GRADE_LABELS[band.grade]} ${formatMoney(
                              valueAt(negotiation, proposed, band.grade),
                            )}`,
                        )
                        .join(" · ")}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setCountering(false)}>
                  <XIcon className="size-4" />
                  Cancel
                </Button>
                <Button
                  onClick={() => send("proposal", { bands: proposed })}
                  disabled={pending || !proposeCheck.allowed}
                >
                  <SendIcon className="size-4" />
                  Send rates
                </Button>
              </div>
            </div>
          ) : null}

          <Separator />

          {/*
            The whole of what can be said. There is no text box, and that is
            deliberate — see `lib/domain/bargain-vocabulary.ts`. A phrase is
            sent on the tap: nothing is drafted, so nothing has to be
            proof-read, and a farmer holding a phone in a field sends a message
            with one thumb.

            Grouped by topic because the list grows: operations add phrases
            from Controls, and thirty unsorted buttons is a wall a farmer
            scrolls past rather than reads.
          */}
          <div className="flex flex-col gap-2">
            <span className="text-faint flex items-center gap-1.5 text-xs">
              <MessageSquareIcon className="size-3.5" />
              Tap to send. Both of you read these in your own language.
            </span>

            {sayable.length === 0 ? (
              <p className="text-warning text-xs">
                No phrases are set up for your side yet. Rates can still be sent.
              </p>
            ) : (
              TOPICS.filter((topic) => sayable.some((p) => p.topic === topic)).map(
                (topic) => (
                  <div key={topic} className="flex flex-col gap-1">
                    <span className="text-faint text-[11px] tracking-wide uppercase">
                      {TOPIC_LABELS[topic]}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sayable
                        .filter((phrase) => phrase.topic === topic)
                        .map((phrase) => {
                          const translated = phrase.text[viewerLocale];
                          const label = translated ?? phrase.text.en;
                          const tag =
                            translated && viewerLocale in LOCALE_META
                              ? LOCALE_META[viewerLocale as Locale].tag
                              : "en-IN";

                          return (
                            <Button
                              key={phrase.id}
                              variant="secondary"
                              size="sm"
                              disabled={pending}
                              onClick={() => void send("note", { phraseId: phrase.id })}
                            >
                              <span lang={tag}>{label}</span>
                            </Button>
                          );
                        })}
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              // Ending it says why, and the reason comes from the list like
              // everything else. The other side is owed one — otherwise they
              // are left guessing whether to hold the stock.
              //
              // Whichever closing phrase exists, since operations can retire
              // the one this used to name. Without one it still ends, silently;
              // refusing to let somebody out of a bargain because the
              // vocabulary is short would be the worse failure.
              void send("withdraw", { phraseId: endPhrase?.id });
            }}
            className="text-muted-foreground hover:text-destructive self-start text-xs underline underline-offset-2"
          >
            End this bargain
          </button>
        </footer>
      )}
    </div>
  );
}
