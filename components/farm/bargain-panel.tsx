"use client";

import { ChevronLeftIcon, ChevronRightIcon, HandshakeIcon } from "lucide-react";

import { BargainConsole } from "@/components/negotiation/bargain-console";
import type { QuickReply } from "@/components/negotiation/bargain-thread";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Negotiation } from "@/lib/domain/negotiation";
import type { FarmListing } from "@/lib/firebase/listings-read";

/**
 * The live bargain for one listing, opened from that listing.
 *
 * Two levels of "multiple", and they are handled in different places on
 * purpose:
 *
 *  - **Several buyers on one listing.** `BargainConsole` already lists the
 *    threads down its own side and switches between them. Nothing to add here.
 *
 *  - **Several listings being bargained over.** That is this header. The panel
 *    is handed every listing with an open bargain and steps between them in
 *    place, so answering four offers is four clicks rather than four rounds of
 *    close, find the row, reopen.
 *
 * Only open threads reach here. Settled ones are on the history page, because
 * a live bargain is a decision with a clock on it and a finished one is a
 * receipt.
 */
export function BargainPanel({
  listing,
  threads,
  siblings,
  onSelect,
  now,
  quickReplies,
  validForMinutes,
  editable,
  onOpenChange,
}: {
  listing: FarmListing | null;
  threads: Negotiation[];
  /** Every listing with an open bargain, for stepping between them. */
  siblings: FarmListing[];
  onSelect: (listing: FarmListing) => void;
  now: number;
  quickReplies: readonly QuickReply[];
  validForMinutes: number;
  editable: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const index = listing ? siblings.findIndex((l) => l.id === listing.id) : -1;
  const many = index >= 0 && siblings.length > 1;

  const step = (by: number) => {
    // Wraps, because a farmer stepping past the last offer means to see the
    // first again, not to hit a wall.
    const next = siblings[(index + by + siblings.length) % siblings.length];
    if (next) onSelect(next);
  };

  return (
    <Sheet open={listing !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        /*
          Wider than the default at both ends. A bargain is a conversation with
          prices in it, and the default sheet wraps every message to three
          lines.

          `data-[side=right]:w-full` rather than plain `w-full`: the sheet ships
          `data-[side=right]:w-3/4`, and a bare utility does not override a
          variant-prefixed one — so on a phone the panel was 293px of a 390px
          screen, with a dead strip beside the chat.
        */
        className="gap-0 p-0 data-[side=right]:w-full sm:max-w-xl"
      >
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <SheetTitle className="flex items-center gap-2">
                <HandshakeIcon className="size-4 shrink-0" />
                <span className="truncate">{listing?.produceName ?? "Bargain"}</span>
              </SheetTitle>
              <SheetDescription>
                {threads.length === 0
                  ? "No buyer has opened a bargain on this listing yet."
                  : threads.length === 1
                    ? "Nothing is binding until one of you accepts."
                    : `${threads.length} buyers are bargaining for this lot.`}
              </SheetDescription>
            </div>

            {many ? (
              <div className="flex shrink-0 items-center gap-1 pr-8">
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Previous listing with a bargain"
                  onClick={() => step(-1)}
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <span className="text-muted-foreground px-1 text-xs tabular-nums">
                  {index + 1} of {siblings.length}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Next listing with a bargain"
                  onClick={() => step(1)}
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </SheetHeader>

        {/* `min-h-0` on every rung of the chain, or the conversation cannot
            scroll inside the panel and simply overflows past the bottom. */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {threads.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              When a buyer offers on this produce, the conversation appears here.
            </p>
          ) : (
            <BargainConsole
              // Keyed by listing so stepping to the next one remounts the
              // console rather than leaving the previous thread selected and
              // the composer half-filled with a reply meant for someone else.
              key={listing?.id}
              // Panel layout: the page version stacks a thread list above the
              // conversation at this width and pushes the chat out of view.
              compact
              threads={threads}
              viewer="farmer"
              now={now}
              quickReplies={quickReplies}
              validForMinutes={validForMinutes}
              editable={editable}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
