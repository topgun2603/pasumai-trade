"use client";

import { PackageIcon, TrendingUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EntityTag } from "@/components/entity-tag";
import { BargainThread } from "@/components/negotiation/bargain-thread";
import type { VocabularyEntry } from "@/lib/domain/bargain-vocabulary";
import { Badge } from "@/components/ui/badge";
import { GRADE_LABELS, QUANTITY_UNITS } from "@/lib/domain/enums";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import type { LotBook } from "@/lib/domain/lot-book";
import { formatRate, money } from "@/lib/domain/money";
import type { GradeBand } from "@/lib/domain/models";
import {
  gap,
  lastProposalBy,
  pricedGrades,
  rateFor,
  standingProposal,
  type Negotiation,
  type Party,
} from "@/lib/domain/negotiation";
import { rank, type BidLine } from "@/lib/domain/partial-bargain";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What the buyer on a thread currently has on the table. */
function buyerStanding(thread: Negotiation): BidLine[] {
  const offer = lastProposalBy(thread, "buyer");
  return (offer?.bands ?? []).map((band) => ({
    grade: band.grade,
    // No quantity on the band means the whole lot, as it always did.
    quantity: band.quantity ?? thread.quantity,
    ratePerUnit: band.ratePerUnit,
  }));
}

/**
 * The bargaining screen: threads down the left, the open one on the right.
 *
 * Sending goes through the API and then `router.refresh()`, so what comes back
 * is what Firestore holds. Optimistically appending would be pleasant and
 * wrong — the other side may have countered or walked away in the meantime,
 * and this screen decides what a farmer is paid.
 */
export function BargainConsole({
  threads,
  viewer,
  now,
  vocabulary,
  remaining,
  books,
  editable,
  compact = false,
  initialThreadId,
}: {
  threads: Negotiation[];
  viewer: Party;
  now: number;
  /** What either side may say, from Controls. */
  vocabulary: readonly VocabularyEntry[];
  /**
   * What is unsold on each listing, keyed by listing id.
   *
   * Several buyers bargain over one lot at once, so the limit belongs to the
   * listing rather than to any one thread.
   */
  remaining?: Readonly<Record<string, readonly GradeQuantity[]>>;
  /** Where each lot stands, keyed by listing id. */
  books?: Readonly<Record<string, LotBook>>;
  editable: boolean;
  /**
   * Panel layout: no sidebar, no viewport-height caps, fills its container.
   *
   * The page layout puts a 20rem thread list beside the conversation and caps
   * both at the viewport. Dropped into a side panel that is narrower than the
   * `lg` breakpoint, the grid collapses to one column, the list stacks *above*
   * the conversation and pushes it out of the panel entirely — which is why a
   * farmer opening a bargain saw a list of bargains and no chat.
   *
   * Here the panel already named the lot, so the sidebar is repeating itself.
   * Several buyers on one lot become a strip of names instead.
   */
  compact?: boolean;
  /** Which thread to open first. Ignored if it is not in `threads`. */
  initialThreadId?: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    // Checked against the list rather than trusted: a thread id in a URL that
    // is not one of theirs must not select anything.
    (initialThreadId && threads.some((t) => t.id === initialThreadId)
      ? initialThreadId
      : threads[0]?.id) ?? null,
  );
  const [pending, setPending] = useState(false);

  const selected = threads.find((t) => t.id === selectedId) ?? threads[0];

  // Who is winning, per lot.
  //
  // Ranked within a listing rather than across the console: "top bid" means
  // most for this produce, and comparing a tomato bid against an onion one
  // would be a badge that means nothing. Two marks, not a combined score —
  // whoever pays most and whoever takes most are usually different buyers, and
  // which matters is the farmer's call.
  const leaders = new Map<string, { bid?: string; quantity?: string }>();
  for (const listingId of new Set(threads.map((t) => t.listingId))) {
    const onThisLot = threads.filter((t) => t.listingId === listingId);
    // Nothing to lead with one bidder — the badge is a comparison.
    if (onThisLot.length < 2) continue;
    const { topBidId, topQuantityId } = rank(onThisLot, buyerStanding);
    leaders.set(listingId, { bid: topBidId, quantity: topQuantityId });
  }

  /** Marks for a thread, shown only to the farmer choosing between buyers. */
  function marksFor(thread: Negotiation) {
    if (viewer !== "farmer") return { top: false, most: false };
    const leader = leaders.get(thread.listingId);
    return {
      top: leader?.bid === thread.id,
      most: leader?.quantity === thread.id,
    };
  }

  async function send(draft: {
    kind: "note" | "proposal" | "accept" | "withdraw";
    phraseId?: string;
    bands?: GradeBand[];
  }): Promise<boolean> {
    if (!selected) return false;

    if (!editable) {
      toast.error("Read only", {
        description:
          "Bargaining is disabled until the console is behind authentication — the endpoint cannot yet tell who is sending.",
      });
      return false;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/negotiations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          author: viewer,
          locale: viewer === "farmer" ? "ta" : "en",
          // Rates and quantities travel as paise and units keyed by grade, not
          // as arrays, so a reordered array cannot quietly reprice or resize
          // the wrong grade.
          bands: draft.bands
            ? Object.fromEntries(draft.bands.map((b) => [b.grade, b.ratePerUnit]))
            : undefined,
          quantities: draft.bands
            ? Object.fromEntries(
                draft.bands
                  .filter((b) => b.quantity !== undefined)
                  .map((b) => [b.grade, b.quantity]),
              )
            : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .then((d: { error?: string; code?: string }) => d)
          .catch(() => ({}) as { error?: string; code?: string });
        const detail = body.error ?? null;

        // 402 is the one refusal the person can clear themselves, so it gets a
        // way out rather than an apology. The button that reached here was
        // deliberately not hidden — seeing what bargaining looks like is how
        // someone decides the plan is worth it.
        if (response.status === 402) {
          toast.error("Subscription needed", {
            description: detail ?? "Bargaining needs an active plan.",
            action: {
              label: "See plans",
              onClick: () => router.push("/account/subscription"),
            },
          });
          return false;
        }

        /*
          The lot moved while this screen sat open.

          "Not sent" would be the wrong thing to say: nothing is wrong with the
          message, the produce is simply no longer there. And the screen is now
          lying — it is still showing an offer with an Accept button against
          stock another buyer has taken — so it is refreshed before the toast,
          which is what makes the stale button go away.
        */
        if (body.code === "soldOut") {
          router.refresh();
          toast.error("This lot has moved", {
            description: detail ?? "Someone else has taken it.",
          });
          return false;
        }

        toast.error("Not sent", {
          description: detail ?? `Server returned ${response.status}.`,
        });
        return false;
      }

      const result = (await response.json()) as { status: string };
      if (result.status === "agreed") {
        toast.success("Price agreed", {
          description: "These rates are now binding for this listing.",
        });
      }

      router.refresh();
      return true;
    } catch {
      toast.error("Could not reach the server");
      return false;
    } finally {
      setPending(false);
    }
  }

  if (threads.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-12 text-sm">
        No bargains yet.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {threads.length > 1 ? (
          // Who is bargaining, as a strip. One row of names beats a column
          // that eats half a narrow panel.
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b pb-2">
            {threads.map((thread) => {
              const active = thread.id === selected?.id;
              const waiting =
                thread.status === "open" && thread.messages.at(-1)?.author !== viewer;
              const { top, most } = marksFor(thread);

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedId(thread.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-accent font-medium"
                      : top
                        ? "border-success/50 bg-success-soft hover:bg-success-soft/80"
                        : "border-border hover:bg-secondary",
                  )}
                >
                  {top ? <TrendingUpIcon className="text-success size-3.5" /> : null}
                  {most && !top ? <PackageIcon className="size-3.5" /> : null}
                  {thread.buyerName}
                  {waiting ? (
                    <span className="bg-warning size-1.5 rounded-full" aria-label="Your move" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          {selected ? (
            <BargainThread
              key={selected.id}
              negotiation={selected}
              viewer={viewer}
              now={now}
              vocabulary={vocabulary}
              remaining={remaining?.[selected.listingId]}
              book={books?.[selected.listingId]}
              onSend={send}
              pending={pending}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[20rem_1fr]">      <ul className="max-h-[calc(100svh-4rem)] overflow-y-auto border-b lg:border-r lg:border-b-0">
        {threads.map((thread) => {
          const standing = standingProposal(thread);
          // A price is waiting on this reader until they answer it. Nothing
          // ages it out any more — a proposal stands until it is taken or
          // withdrawn.
          const waiting =
            thread.status === "open" &&
            standing !== undefined &&
            standing.author !== viewer;
          const distance = gap(thread);
          const last = thread.messages.at(-1);
          const active = thread.id === selected?.id;
          const { top, most } = marksFor(thread);

          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setSelectedId(thread.id)}
                aria-current={active}
                className={cn(
                  "hover:bg-muted/60 focus-visible:ring-ring flex w-full flex-col gap-1.5 border-b border-l-2 border-l-transparent p-3 text-left focus-visible:ring-2 focus-visible:outline-none",
                  // The mark is a left edge rather than a fill, so it survives
                  // being the selected row — the farmer needs to see it is the
                  // best offer while they are reading it.
                  top && "border-l-success",
                  most && !top && "border-l-primary",
                  active && "bg-muted",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{thread.produceName}</span>
                  {thread.status === "open" ? (
                    waiting ? (
                      <Badge className="bg-warning-soft text-warning border-warning/40 border">
                        Your move
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Waiting</Badge>
                    )
                  ) : (
                    <Badge
                      variant="outline"
                      className={
                        thread.status === "agreed"
                          ? "border-success/40 bg-success-soft text-success"
                          : "text-muted-foreground"
                      }
                    >
                      {thread.status === "agreed" ? "Agreed" : "Closed"}
                    </Badge>
                  )}
                </span>

                {/* The other side, in their own colour. A farmer with four
                    threads open is looking for which buyer, not which row. */}
                <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <EntityTag
                    kind={viewer === "buyer" ? "farmer" : "buyer"}
                    name={viewer === "buyer" ? thread.farmerName : thread.buyerName}
                    compact
                  />
                  <span className="tabular">
                    {thread.quantity} {QUANTITY_UNITS[thread.unit].en}
                  </span>
                </span>

                {top || most ? (
                  <span className="flex flex-wrap gap-1">
                    {top ? (
                      <Badge className="border-success/40 bg-success-soft text-success gap-1 border">
                        <TrendingUpIcon className="size-3" />
                        Best price
                      </Badge>
                    ) : null}
                    {most ? (
                      <Badge variant="secondary" className="gap-1">
                        <PackageIcon className="size-3" />
                        Takes the most
                      </Badge>
                    ) : null}
                  </span>
                ) : null}

                <span className="text-faint flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {/* The grades actually priced. Reading grade A off every
                        proposal reported "₹0/kg / A" for a bid on the B
                        grade — a rate nobody quoted. */}
                    {last?.kind === "proposal"
                      ? (() => {
                          const priced = pricedGrades(last.bands ?? []);
                          const lead = priced[0];
                          const who = last.author === viewer ? "You" : "They";
                          if (!lead) return `${who} proposed rates`;
                          return (
                            `${who} proposed ${formatRate(
                              money(rateFor(last.bands ?? [], lead)!),
                              QUANTITY_UNITS[thread.unit].en,
                            )} / ${GRADE_LABELS[lead]}` +
                            (priced.length > 1 ? ` +${priced.length - 1}` : "")
                          );
                        })()
                      : (last?.text ?? "No messages")}
                  </span>
                  {last ? <span>{relativeTime(last.sentAt, now)}</span> : null}
                </span>

                {thread.status === "open" && distance.a !== undefined ? (
                  <span className="text-faint tabular text-xs">
                    {formatRate(money(distance.a), QUANTITY_UNITS[thread.unit].en)}{" "}
                    apart on grade A
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="max-h-[calc(100svh-4rem)] min-h-0">
        {selected ? (
          <BargainThread
            key={selected.id}
            negotiation={selected}
            viewer={viewer}
            now={now}
            vocabulary={vocabulary}
            remaining={remaining?.[selected.listingId]}
            book={books?.[selected.listingId]}
            onSend={send}
            pending={pending}
          />
        ) : null}
      </div>
    </div>
  );
}
