"use client";

import { HandshakeIcon } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BargainConsole } from "@/components/negotiation/bargain-console";
import type { QuickReply } from "@/components/negotiation/bargain-thread";
import type { Negotiation } from "@/lib/domain/negotiation";

/**
 * The live bargain for one listing, opened from that listing.
 *
 * From the left, deliberately. A bargain is read alongside the produce it is
 * about — the farmer is checking a price against the lot they can see in the
 * row behind — and a panel on the right covers the listing it belongs to on
 * every laptop width. From the left it sits beside it.
 *
 * Only open threads reach here. Settled ones live in the history page, because
 * a finished bargain is a record and a live one is a decision, and mixing them
 * means scrolling past last month's sales to answer today's offer.
 */
export function BargainPanel({
  listing,
  threads,
  now,
  quickReplies,
  validForMinutes,
  editable,
  onOpenChange,
}: {
  listing: { id: string; produceName: string } | null;
  threads: Negotiation[];
  now: number;
  quickReplies: readonly QuickReply[];
  validForMinutes: number;
  editable: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={listing !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        // Wider than the default: a bargain is a conversation with prices in
        // it, and the default sheet width wraps every message to three lines.
        className="w-full gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <HandshakeIcon className="size-4" />
            {listing?.produceName ?? "Bargain"}
          </SheetTitle>
          <SheetDescription>
            {threads.length === 0
              ? "No buyer has opened a bargain on this listing yet."
              : "Nothing is binding until one of you accepts."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {threads.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              When a buyer offers on this produce, the conversation appears here.
            </p>
          ) : (
            <BargainConsole
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
