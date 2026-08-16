"use client";

import { HandshakeIcon, TriangleAlertIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import { paiseToRupees, rupeesToPaise } from "@/lib/domain/listing-draft";
import { formatMoney } from "@/lib/domain/money";

/**
 * The buyer's first move on a lot.
 *
 * Pre-filled with the farmer's asking price where they gave one, so the buyer
 * is countering a number rather than inventing one. Editable, obviously —
 * that is the whole exercise — but starting from the ask rather than from
 * blank is the difference between a negotiation and a lowball.
 *
 * Per grade, and any subset. A buyer who only wants the A grade offers on A
 * and leaves the rest alone; the domain accepts that and has since grades
 * were split.
 */
export function OpenBargainDialog({
  listing,
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
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={listing !== null} onOpenChange={onOpenChange}>
      {listing ? (
        <Body key={listing.id} listing={listing} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function Body({
  listing,
  onDone,
}: {
  listing: NonNullable<Parameters<typeof OpenBargainDialog>[0]["listing"]>;
  onDone: () => void;
}) {
  const router = useRouter();

  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(listing.grades.map((g) => [g.grade, paiseToRupees(g.askingRate)])),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const offered = listing.grades
    .map((g) => ({ grade: g.grade, paise: rupeesToPaise(rates[g.grade] ?? "") }))
    .filter((g) => g.paise !== undefined);

  async function send() {
    setError(null);

    if (offered.length === 0 && !note.trim()) {
      setError("Offer a price on at least one grade, or write a message.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/negotiations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        listingId: listing.id,
        bands: Object.fromEntries(offered.map((g) => [g.grade, g.paise])),
        text: note.trim() || undefined,
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
    <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-md">
      <DialogHeader className="border-b px-5 py-4">
        <DialogTitle>Bargain for {listing.produceName.toLowerCase()}</DialogTitle>
        <DialogDescription>
          {listing.farmerName}, {listing.village}. Nothing is binding until one of you accepts.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-2">
          <Label>Your offer, per {listing.unit}</Label>

          {listing.grades.map((g) => (
            <div key={g.grade} className="flex items-center gap-3">
              <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-md font-medium">
                {g.grade.toUpperCase()}
              </span>
              <span className="text-muted-foreground min-w-0 flex-1 text-xs">
                {g.quantity} {listing.unit} available
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
              <div className="relative w-28 shrink-0">
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
            </div>
          ))}

          <p className="text-muted-foreground text-xs">
            Pre-filled with what the farmer is asking. Change what you want to change, and leave a
            grade blank if you do not want it.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Message — optional</Label>
          <Textarea
            id="note"
            rows={3}
            placeholder="When you can collect, how much you want, anything else."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

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
        <Button type="button" disabled={busy} onClick={send}>
          <HandshakeIcon className="size-4" />
          {busy ? "Opening…" : "Send offer"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
