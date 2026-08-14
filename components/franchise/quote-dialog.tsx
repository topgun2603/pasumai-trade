"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GRADE_LABELS, GRADES, unitLabel, type Grade } from "@/lib/domain/enums";
import { formatMoney, forQuantity, money } from "@/lib/domain/money";
import { marketHigh, marketLow, type Listing } from "@/lib/domain/models";
import { shortDate } from "@/lib/format";

const EXPIRY_OPTIONS = [
  { value: "1", label: "1 hour" },
  { value: "4", label: "4 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "24 hours" },
];

/** Rupees typed by the operator → integer minor units. */
function toMinorUnits(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

/**
 * Quote all three grade bands against a listing.
 *
 * Every grade is priced before the truck moves. Grading happens physically at
 * pickup with the farmer present, so agreeing all three up front is what stops
 * the price being reopened at the roadside with a vehicle idling — which is
 * also why this dialog will not submit with a band missing.
 *
 * The caller mounts this with `key={listing.id}`, so opening a different
 * listing remounts it with fresh state. That is the reset — no effect syncing
 * props into state.
 */
export function QuoteDialog({
  listing,
  now,
  onOpenChange,
}: {
  listing: Listing;
  now: number;
  onOpenChange: (open: boolean) => void;
}) {
  // Seeded from the existing offer on a requote, so the operator adjusts
  // rather than retypes.
  const [rates, setRates] = useState<Record<Grade, string>>(() => ({
    a: seedRate(listing, "a"),
    b: seedRate(listing, "b"),
    c: seedRate(listing, "c"),
  }));
  const [expiry, setExpiry] = useState("4");
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(
    () => ({
      a: toMinorUnits(rates.a),
      b: toMinorUnits(rates.b),
      c: toMinorUnits(rates.c),
    }),
    [rates],
  );

  const allPresent = GRADES.every((g) => parsed[g] !== null);
  const anyInvalid = GRADES.some(
    (g) => rates[g].trim() !== "" && parsed[g] === null,
  );

  // Best grade first is a domain invariant, not a preference: the farmer reads
  // the bands as a ladder and an inverted one is a mistake, not an offer.
  const ordered =
    allPresent && parsed.a! >= parsed.b! && parsed.b! >= parsed.c!;

  const canSubmit = allPresent && !anyInvalid && ordered && !submitting;

  const unit = unitLabel(listing.unit);

  function submit() {
    if (!canSubmit) return;
    setSubmitting(true);

    // Stands in for POST /api/v1/listings/{id}/offers. The route handler will
    // re-validate every rule above server-side — this check is for the
    // operator, not for the data.
    const hours = Number(expiry);
    const expiresAt = new Date(now + hours * 3_600_000);

    setTimeout(() => {
      setSubmitting(false);
      onOpenChange(false);
      toast.success(`Offer sent to ${listing.farmer.name}`, {
        description: `${listing.produce.names.en} · ${listing.id} · expires in ${
          EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label
        } at ${expiresAt.toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
        })}`,
      });
    }, 450);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden>{listing.produce.emoji}</span>
            Quote {listing.produce.names.en}
          </DialogTitle>
          <DialogDescription>
            {listing.farmer.name} · {listing.farmer.village},{" "}
            {listing.farmer.district} · {listing.id}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-secondary flex items-center justify-between rounded-md px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Mandi reference</span>
          <span className="flex flex-col items-end leading-tight">
            <span className="tabular font-medium">
              {formatMoney(marketLow(listing.marketRate))} –{" "}
              {formatMoney(marketHigh(listing.marketRate))} / {unit}
            </span>
            <span className="text-faint text-xs">
              {listing.marketRate.source} · {shortDate(listing.marketRate.asOf)}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Grade bands</span>
            <span className="text-faint text-xs">
              per {unit} · {listing.quantity.toLocaleString("en-IN")} {unit}{" "}
              listed
            </span>
          </div>

          {GRADES.map((g) => {
            const minor = parsed[g];
            const invalid = rates[g].trim() !== "" && minor === null;
            const total =
              minor !== null ? forQuantity(minor, listing.quantity) : null;

            return (
              <div key={g} className="flex items-center gap-3">
                <Label
                  htmlFor={`grade-${g}`}
                  className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
                >
                  {GRADE_LABELS[g]}
                </Label>
                <div className="relative flex-1">
                  <span className="text-faint pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
                    ₹
                  </span>
                  <Input
                    id={`grade-${g}`}
                    inputMode="decimal"
                    value={rates[g]}
                    onChange={(e) =>
                      setRates((r) => ({ ...r, [g]: e.target.value }))
                    }
                    placeholder="0"
                    aria-invalid={invalid}
                    aria-describedby={`grade-${g}-total`}
                    className="tabular pl-6"
                  />
                </div>
                <span
                  id={`grade-${g}-total`}
                  className="text-muted-foreground tabular w-28 shrink-0 text-right text-sm"
                >
                  {total ? formatMoney(total) : "—"}
                </span>
              </div>
            );
          })}

          {anyInvalid ? (
            <p className="text-destructive flex items-center gap-1.5 text-xs">
              <TriangleAlertIcon className="size-3.5 shrink-0" />
              Enter a rupee amount, up to two decimals.
            </p>
          ) : null}

          {allPresent && !ordered ? (
            <p className="text-destructive flex items-center gap-1.5 text-xs">
              <TriangleAlertIcon className="size-3.5 shrink-0" />
              Grade A must be at least B, and B at least C. The farmer reads the
              bands as a ladder.
            </p>
          ) : null}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="expiry" className="text-sm font-medium">
            Farmer has
          </Label>
          <Select value={expiry} onValueChange={setExpiry}>
            <SelectTrigger id="expiry" className="w-40">
              <SelectValue>
                {EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-faint text-xs">
          The farmer sees a countdown. When it runs out the offer closes and the
          listing returns here for a requote.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? "Sending…" : "Send offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Existing band as a rupee string for the input, or blank on a first quote. */
function seedRate(listing: Listing, grade: Grade): string {
  const band = listing.offer?.bands.find((b) => b.grade === grade);
  return band ? String(money(band.ratePerUnit).minorUnits / 100) : "";
}
