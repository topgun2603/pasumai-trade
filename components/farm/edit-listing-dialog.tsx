"use client";

import { TriangleAlertIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADES } from "@/lib/domain/enums";
import type { FarmListing } from "@/lib/firebase/listings-read";

/**
 * Changing what is on offer.
 *
 * Quantities and readiness only. The crop is not editable — a listing whose
 * produce changed is a different listing, and a buyer part-way through a
 * bargain for tomatoes should not find themselves negotiating for onions.
 * Photographs are not editable here either: replacing them mid-bargain would
 * change what a buyer already priced against.
 *
 * Keyed by listing at the call site, so opening a different row resets the
 * fields rather than carrying the last one's numbers over.
 */
export function EditListingDialog({
  listing,
  crops,
  onOpenChange,
}: {
  listing: FarmListing | null;
  crops: Array<{ id: string; en: string; unit: string }>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={listing !== null} onOpenChange={onOpenChange}>
      {listing ? (
        <Body key={listing.id} listing={listing} crops={crops} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function Body({
  listing,
  crops,
  onDone,
}: {
  listing: FarmListing;
  crops: Array<{ id: string; en: string; unit: string }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const unit = crops.find((c) => c.id === listing.produceId)?.unit ?? listing.unit;

  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(listing.grades.map((g) => [g.grade, String(g.quantity)])),
  );
  const [readyIn, setReadyIn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const grades = GRADES.map((grade) => ({
    grade,
    quantity: Number(quantities[grade] ?? "") || 0,
  }));
  const total = grades.reduce((sum, g) => sum + Math.max(0, g.quantity), 0);

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (grades.every((g) => g.quantity <= 0)) {
      setError("Keep at least one grade. Take it off the market instead of emptying it.");
      return;
    }
    if (grades.some((g) => g.quantity < 0 || g.quantity > 100_000)) {
      setError("Those quantities do not look right.");
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grades: Object.fromEntries(
          grades.filter((g) => g.quantity > 0).map((g) => [g.grade, g.quantity]),
        ),
        ...(readyIn ? { readyIn } : {}),
      }),
    }).catch(() => null);
    setSaving(false);

    if (!response?.ok) {
      const detail = await response?.json().catch(() => ({}));
      setError(detail?.error ?? "Could not save that.");
      return;
    }

    toast.success("Listing updated");
    onDone();
    router.refresh();
  }

  return (
    <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-md">
      <DialogHeader className="border-b px-5 py-4">
        <DialogTitle>{listing.produceName}</DialogTitle>
        <DialogDescription>
          Change how much is on offer. The crop and photos stay as they are.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={save} noValidate className="contents">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Quantity by grade</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {total} {unit} in total
              </span>
            </div>

            {GRADES.map((grade) => (
              <div key={grade} className="flex items-center gap-3">
                <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-md font-medium">
                  {grade.toUpperCase()}
                </span>
                <Input
                  aria-label={`Grade ${grade.toUpperCase()} quantity`}
                  inputMode="decimal"
                  placeholder="0"
                  className="flex-1 text-right"
                  value={quantities[grade] ?? ""}
                  onChange={(e) => {
                    setQuantities((q) => ({ ...q, [grade]: e.target.value }));
                    setError(null);
                  }}
                />
                <span className="text-muted-foreground w-6 text-xs">{unit}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ready">When is it ready?</Label>
            <Select value={readyIn} onValueChange={setReadyIn}>
              <SelectTrigger id="ready">
                <SelectValue placeholder="Leave as it is" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Ready now</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="3days">In two or three days</SelectItem>
                <SelectItem value="week">Within a week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <TriangleAlertIcon className="size-3 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
