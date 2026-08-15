"use client";

import { SproutIcon, TriangleAlertIcon } from "lucide-react";
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
  DialogTrigger,
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

export interface CropOption {
  id: string;
  en: string;
  ta: string;
  unit: string;
}

/**
 * Posting produce.
 *
 * Four fields, because this is filled in standing in a field on a phone. No
 * price: the price is what the bargaining is for, and asking a farmer to name
 * one up front is exactly the anchor this platform exists to remove.
 *
 * The crop list is bilingual on one line rather than behind a language toggle.
 * A farmer who reads Tamil and a franchise operator who reads English use the
 * same list, and a toggle is a step where somebody picks wrong.
 */
export function PostProduceDialog({ crops }: { crops: CropOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [produceId, setProduceId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [readyIn, setReadyIn] = useState("today");
  const [errors, setErrors] = useState<{ produceId?: string; quantity?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const crop = crops.find((c) => c.id === produceId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found: { produceId?: string; quantity?: string } = {};
    if (!produceId) found.produceId = "Choose what you are selling";

    const amount = Number(quantity);
    if (!quantity.trim()) {
      found.quantity = "How much do you have?";
    } else if (!Number.isFinite(amount) || amount <= 0) {
      found.quantity = "Enter a number greater than zero";
    } else if (amount > 100_000) {
      // Not a rule about farms, a rule about typos: an extra zero on a phone
      // keypad is the most likely way this number goes wrong.
      found.quantity = "That looks like a typo. Check the quantity.";
    }

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    let response: Response;
    try {
      response = await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ produceId, quantity: amount, readyIn }),
      });
    } catch {
      setSubmitting(false);
      toast.error("Could not reach the server. Try again when you have signal.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
    };
    setSubmitting(false);

    if (!response.ok) {
      if (response.status === 402) {
        toast.error("Subscription needed", {
          description: data.error ?? "Posting produce needs an active plan.",
          action: { label: "See plans", onClick: () => router.push("/farm/subscription") },
        });
        return;
      }
      toast.error(data.error ?? "Could not post that.");
      return;
    }

    setOpen(false);
    setProduceId("");
    setQuantity("");
    toast.success("Posted", {
      description: "Buyers in your district can see it now.",
    });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <SproutIcon className="size-4" />
          Post produce
        </Button>
      </DialogTrigger>

      {/* Scrolling body with a pinned footer, so Post is never below the fold
          on a short phone screen. Same shape as the crop and quote dialogs. */}
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Post produce</DialogTitle>
          <DialogDescription>
            No price here. Buyers make an offer and you bargain from there.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="contents">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="produce">What are you selling?</Label>
              <Select value={produceId} onValueChange={(v) => {
                setProduceId(v);
                setErrors((e) => ({ ...e, produceId: undefined }));
              }}>
                <SelectTrigger id="produce" aria-invalid={Boolean(errors.produceId)}>
                  <SelectValue placeholder="Choose a crop" />
                </SelectTrigger>
                <SelectContent>
                  {crops.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.en}
                      {c.ta && c.ta !== c.en ? (
                        <span lang="ta" className="text-muted-foreground ml-2">
                          {c.ta}
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.produceId ? (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlertIcon className="size-3 shrink-0" />
                  {errors.produceId}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">
                How much? {crop ? <span className="text-faint">({crop.unit})</span> : null}
              </Label>
              <Input
                id="quantity"
                // `decimal` rather than `numeric`: a farmer entering 12.5
                // quintals needs the point, and `numeric` hides it on Android.
                inputMode="decimal"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setErrors((x) => ({ ...x, quantity: undefined }));
                }}
                aria-invalid={Boolean(errors.quantity)}
                placeholder="800"
              />
              {errors.quantity ? (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlertIcon className="size-3 shrink-0" />
                  {errors.quantity}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ready">When is it ready?</Label>
              <Select value={readyIn} onValueChange={setReadyIn}>
                <SelectTrigger id="ready">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Ready now</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="3days">In two or three days</SelectItem>
                  <SelectItem value="week">Within a week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t px-5 py-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Posting…" : "Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
