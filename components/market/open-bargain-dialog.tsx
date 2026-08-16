"use client";

import { HandshakeIcon, MessageSquareIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { phrasesFor, type VocabularyEntry } from "@/lib/domain/bargain-vocabulary";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import { paiseToRupees, rupeesToPaise } from "@/lib/domain/listing-draft";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/**
 * The buyer's first move on a lot.
 *
 * Two numbers per grade, not one: a rate and a quantity. A buyer wanting two
 * hundred kilos of the A grade off an eight-hundred-kilo lot used to have to
 * say so in a message and hope the farmer read it — the offer itself was for
 * everything, and the farmer accepting it was agreeing to sell the lot. Now the
 * offer says what it is for, and what is not taken stays on the market.
 *
 * Rates are pre-filled with the farmer's ask where they gave one, so the buyer
 * is countering a number rather than inventing one. Quantities are left blank,
 * meaning all of what is available — because taking the lot is the ordinary
 * case and should not need typing.
 */
export function OpenBargainDialog({
  listing,
  vocabulary,
  onOpenChange,
}: {
  listing: {
    id: string;
    produceName: string;
    farmerName: string;
    village: string;
    unit: string;
    grades: readonly GradeQuantity[];
  } | null;
  /** What a buyer may say, from Controls. */
  vocabulary: readonly VocabularyEntry[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={listing !== null} onOpenChange={onOpenChange}>
      {listing ? (
        <Body
          key={listing.id}
          listing={listing}
          vocabulary={vocabulary}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function Body({
  listing,
  vocabulary,
  onDone,
}: {
  listing: NonNullable<Parameters<typeof OpenBargainDialog>[0]["listing"]>;
  vocabulary: readonly VocabularyEntry[];
  onDone: () => void;
}) {
  const router = useRouter();

  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(listing.grades.map((g) => [g.grade, paiseToRupees(g.askingRate)])),
  );
  const [wanted, setWanted] = useState<Record<string, string>>({});
  const [phraseId, setPhraseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sayable = phrasesFor(vocabulary, "buyer");

  /** What is available at a grade, from the listing as the market shows it. */
  const availableAt = (grade: string) =>
    listing.grades.find((g) => g.grade === grade)?.quantity ?? 0;

  // A blank rate means "not bidding on this grade". A blank quantity means all
  // of what is there, which is why it is a placeholder rather than a value.
  const offered = listing.grades
    .map((g) => {
      const paise = rupeesToPaise(rates[g.grade] ?? "");
      const typed = (wanted[g.grade] ?? "").trim();
      return {
        grade: g.grade,
        paise,
        quantity: typed === "" ? g.quantity : Number(typed),
      };
    })
    .filter((g) => g.paise !== undefined);

  const overAsked = offered.filter(
    (g) => !Number.isInteger(g.quantity) || g.quantity <= 0 || g.quantity > availableAt(g.grade),
  );

  const total = offered.reduce((sum, g) => sum + (g.paise ?? 0) * g.quantity, 0);
  const partial = offered.some((g) => g.quantity < availableAt(g.grade));

  async function send() {
    setError(null);

    if (offered.length === 0 && !phraseId) {
      setError("Offer a price on at least one grade, or pick a message.");
      return;
    }

    if (overAsked.length > 0) {
      const g = overAsked[0];
      setError(
        `Grade ${g.grade.toUpperCase()}: ask for a whole number between 1 and ${availableAt(g.grade)}.`,
      );
      return;
    }

    setBusy(true);
    const response = await fetch("/api/negotiations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        listingId: listing.id,
        // Keyed by grade rather than sent as arrays, so a reordered list cannot
        // quietly attach a rate or a quantity to the wrong grade.
        bands: Object.fromEntries(offered.map((g) => [g.grade, g.paise])),
        quantities: Object.fromEntries(offered.map((g) => [g.grade, g.quantity])),
        phraseId: phraseId ?? undefined,
      }),
    }).catch(() => null);

    setBusy(false);
    const data = (await response?.json().catch(() => ({}))) as { error?: string };

    if (!response?.ok) {
      setError(data?.error ?? "Could not open that bargain.");
      return;
    }

    onDone();
    toast.success("Bargain opened", {
      description: `${listing.farmerName} will see your offer.`,
      action: { label: "Open", onClick: () => router.push("/bargains") },
    });
    router.refresh();
  }

  return (
    <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-lg">
      <DialogHeader className="border-b px-5 py-4">
        <DialogTitle>Bargain for {listing.produceName.toLowerCase()}</DialogTitle>
        <DialogDescription>
          {listing.farmerName}, {listing.village}. Nothing is binding until one of you accepts.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-3 pr-1 text-xs">
            <span className="flex-1">Grade</span>
            <span className="w-24 text-right">₹ per {listing.unit}</span>
            <span className="w-24 text-right">How much</span>
          </div>

          {listing.grades.map((g) => {
            const available = g.quantity;
            const typed = (wanted[g.grade] ?? "").trim();
            const bad =
              typed !== "" &&
              (!Number.isInteger(Number(typed)) ||
                Number(typed) <= 0 ||
                Number(typed) > available);

            return (
              <div key={g.grade} className="flex items-center gap-3">
                <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-md font-medium">
                  {g.grade.toUpperCase()}
                </span>

                <span className="text-muted-foreground min-w-0 flex-1 text-xs">
                  {available} {listing.unit} available
                  {g.askingRate ? (
                    <>
                      {" · asking "}
                      <span className="text-foreground font-medium">
                        {formatMoney({ minorUnits: g.askingRate, currency: "INR" })}
                      </span>
                    </>
                  ) : (
                    " · open to offers"
                  )}
                </span>

                <div className="relative w-24 shrink-0">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
                    ₹
                  </span>
                  <Input
                    aria-label={`Offer for grade ${g.grade.toUpperCase()}`}
                    inputMode="decimal"
                    placeholder="—"
                    className="pl-6 text-right"
                    value={rates[g.grade] ?? ""}
                    onChange={(e) => {
                      setRates((r) => ({ ...r, [g.grade]: e.target.value }));
                      setError(null);
                    }}
                  />
                </div>

                <Input
                  aria-label={`Quantity wanted of grade ${g.grade.toUpperCase()} in ${listing.unit}`}
                  inputMode="numeric"
                  // The available figure as a placeholder: an empty box that
                  // means "all of it" reads as one decision, where a prefilled
                  // number reads as one to check.
                  placeholder={String(available)}
                  className={cn(
                    "w-24 shrink-0 text-right",
                    bad && "border-destructive focus-visible:ring-destructive",
                  )}
                  value={wanted[g.grade] ?? ""}
                  onChange={(e) => {
                    setWanted((w) => ({ ...w, [g.grade]: e.target.value }));
                    setError(null);
                  }}
                />
              </div>
            );
          })}

          <p className="text-muted-foreground text-xs">
            Rates are pre-filled with what the farmer is asking. Leave a grade blank
            if you do not want it, and a quantity blank to take all of that grade.
          </p>
        </div>

        {offered.length > 0 && overAsked.length === 0 ? (
          <div className="bg-muted/50 flex items-baseline justify-between gap-3 rounded-lg border px-3 py-2">
            <span className="text-muted-foreground text-xs">
              {partial ? "Part of the lot" : "The whole lot"} ·{" "}
              {offered.map((g) => `${g.quantity} ${g.grade.toUpperCase()}`).join(" + ")}
            </span>
            <span className="tabular font-medium">
              {formatMoney({ minorUnits: total, currency: "INR" })}
            </span>
          </div>
        ) : null}

        {/*
          A message, from the fixed list — the same one the bargaining screen
          uses. There is no free-text box here for the same reason there is none
          there: an opening offer is where a phone number would be most useful
          to whoever wanted the trade off the platform.
        */}
        {sayable.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              <MessageSquareIcon className="size-3.5" />
              Add a message — optional
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {sayable.map((phrase) => (
                <Button
                  key={phrase.id}
                  type="button"
                  size="sm"
                  variant={phraseId === phrase.id ? "default" : "secondary"}
                  onClick={() =>
                    setPhraseId((current) => (current === phrase.id ? null : phrase.id))
                  }
                >
                  {phrase.text.en}
                </Button>
              ))}
            </div>
            <p className="text-faint text-xs">
              The farmer reads it in their own language. Tap again to remove it.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="text-destructive flex items-center gap-1 text-xs">
            <TriangleAlertIcon className="size-3 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t px-5 py-4">
        <Button type="button" variant="outline" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" disabled={busy || overAsked.length > 0} onClick={send}>
          <HandshakeIcon className="size-4" />
          {busy ? "Opening…" : "Send offer"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
