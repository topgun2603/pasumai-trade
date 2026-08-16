"use client";

import { SproutIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  emptyRows,
  GradeRows,
  rowsToPayload,
  type GradeRowState,
} from "@/components/farm/grade-rows";
import { MediaPicker, type PickedFile } from "@/components/farm/media-picker";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuantityUnit } from "@/lib/domain/enums";
import {
  hasDraftErrors,
  isQuantityUnit,
  validateDraft,
  type DraftErrors,
  type GradeQuantity,
} from "@/lib/domain/listing-draft";

export interface CropOption {
  id: string;
  en: string;
  ta: string;
  unit: string;
}

/**
 * Posting produce.
 *
 * Filled in standing in a field on a phone: a grade split rather than one
 * number, the unit the farmer actually sells in, and an asking price per grade.
 *
 * Grades separately because a cut of tomatoes is not "800 kg of tomatoes" —
 * it is some A, more B and a little C, and each fetches its own rate. Any
 * subset is fine: a farmer with only B fills in one box and leaves the others
 * alone rather than typing zeroes to say "none".
 *
 * The asking price is optional and it does not settle anything — a buyer still
 * offers and the farmer still accepts. It exists so the farmer is not
 * negotiating from nowhere, anchored by whatever the first buyer happens to
 * say.
 */
export function PostProduceDialog({ crops }: { crops: CropOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [produceId, setProduceId] = useState("");
  const [rows, setRows] = useState<GradeRowState>(emptyRows);
  const [unit, setUnit] = useState<QuantityUnit>("kg");
  const [readyIn, setReadyIn] = useState("today");
  const [images, setImages] = useState<PickedFile[]>([]);
  const [video, setVideo] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [stage, setStage] = useState<"idle" | "uploading" | "posting">("idle");

  const busy = stage !== "idle";

  const payload = rowsToPayload(rows);
  const gradeQuantities: GradeQuantity[] = Object.entries(payload).map(([grade, v]) => ({
    grade: grade as GradeQuantity["grade"],
    quantity: v.quantity,
    askingRate: v.rate,
  }));

  function reset() {
    for (const picked of images) URL.revokeObjectURL(picked.preview);
    if (video) URL.revokeObjectURL(video.preview);
    setProduceId("");
    setRows(emptyRows);
    setImages([]);
    setVideo(null);
    setErrors({});
  }

  /**
   * Uploads straight to storage with URLs this server signed.
   *
   * The bytes never touch the application server: a thirty-second video is far
   * past the request-body limit a serverless function will take, so a proxied
   * upload would work for every photograph and fail on the first real video.
   */
  async function uploadAll(): Promise<{ imagePaths: string[]; videoPath?: string } | null> {
    const files = [
      ...images.map((i) => ({ kind: "image" as const, file: i.file })),
      ...(video ? [{ kind: "video" as const, file: video.file }] : []),
    ];

    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        files: files.map((f) => ({
          kind: f.kind,
          contentType: f.file.type || "application/octet-stream",
          bytes: f.file.size,
        })),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      uploads?: Array<{ path: string; url: string; contentType: string }>;
      error?: string;
    };

    if (!response.ok || !data.uploads) {
      toast.error(data.error ?? "Could not start the upload.");
      return null;
    }

    // In parallel: five photos one after another on a village connection is a
    // minute of somebody standing in a field watching a spinner.
    const results = await Promise.all(
      data.uploads.map(async (upload, index) => {
        const file = files[index].file;
        const put = await fetch(upload.url, {
          method: "PUT",
          // Must match what was signed, byte for byte, or the bucket rejects it.
          headers: { "content-type": upload.contentType },
          body: file,
        });
        return put.ok ? upload.path : null;
      }),
    );

    if (results.some((r) => r === null)) {
      toast.error("Some files did not upload. Check your connection and try again.");
      return null;
    }

    const paths = results as string[];
    return {
      imagePaths: paths.slice(0, images.length),
      videoPath: video ? paths[images.length] : undefined,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    // The same function the server runs, so nothing is valid here and invalid
    // there. Media is checked against what has been picked, not uploaded.
    const found = validateDraft({
      produceId,
      unit,
      grades: gradeQuantities,
      readyIn,
      imagePaths: images.map((i) => i.file.name),
      videoPath: video?.file.name,
    });
    setErrors(found);
    if (hasDraftErrors(found)) return;

    setStage("uploading");
    const media = await uploadAll();
    if (!media) {
      setStage("idle");
      return;
    }

    setStage("posting");
    let response: Response;
    try {
      response = await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          produceId,
          unit,
          grades: payload,
          readyIn,
          imagePaths: media.imagePaths,
          videoPath: media.videoPath,
        }),
      });
    } catch {
      setStage("idle");
      toast.error("Could not reach the server. Try again when you have signal.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as { error?: string; field?: string };
    setStage("idle");

    if (!response.ok) {
      if (response.status === 402 || response.status === 403) {
        toast.error(data.error ?? "This needs a plan.", {
          action: { label: "Open", onClick: () => router.push("/farm/subscription") },
        });
        return;
      }
      if (data.field) setErrors({ [data.field]: data.error } as DraftErrors);
      else toast.error(data.error ?? "Could not post that.");
      return;
    }

    setOpen(false);
    reset();
    toast.success("Posted", { description: "Buyers in your district can see it now." });
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <SproutIcon className="size-4" />
          Post produce
        </Button>
      </DialogTrigger>

      {/* Scrolling body with a pinned footer, so Post is never below the fold
          on a short phone screen. Same shape as the crop and quote dialogs. */}
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Post produce</DialogTitle>
          <DialogDescription>
            No price here. Buyers make an offer and you bargain from there.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="contents">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="produce">What are you selling?</Label>
              <Select
                value={produceId}
                onValueChange={(v) => {
                  setProduceId(v);
                  // A suggestion, not a lock: the crop's usual unit is a good
                  // default and the farmer can still say crate.
                  const suggested = crops.find((c) => c.id === v)?.unit;
                  if (suggested && isQuantityUnit(suggested)) setUnit(suggested);
                  setErrors((e) => ({ ...e, produce: undefined }));
                }}
              >
                <SelectTrigger id="produce" aria-invalid={Boolean(errors.produce)}>
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
              {errors.produce ? (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlertIcon className="size-3 shrink-0" />
                  {errors.produce}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <GradeRows
                rows={rows}
                unit={unit}
                disabled={busy}
                onRows={(next) => {
                  setRows(next);
                  setErrors((e) => ({ ...e, grades: undefined, rates: undefined }));
                }}
                onUnit={setUnit}
              />
              {errors.grades || errors.rates ? (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlertIcon className="size-3 shrink-0" />
                  {errors.grades ?? errors.rates}
                </p>
              ) : null}
            </div>

            <MediaPicker
              images={images}
              video={video}
              disabled={busy}
              onImages={(next) => {
                setImages(next);
                setErrors((e) => ({ ...e, images: undefined }));
              }}
              onVideo={setVideo}
              onError={(message) => toast.error(message)}
            />
            {errors.images ? (
              <p className="text-destructive -mt-3 flex items-center gap-1 text-xs">
                <TriangleAlertIcon className="size-3 shrink-0" />
                {errors.images}
              </p>
            ) : null}

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

          {/* `mx-0 mb-0` cancels the negative margins DialogFooter ships for a
              p-4 content box. This dialog is p-0 with its own padding, so those
              were pulling the footer outside the panel and rounding it as a
              separate slab over the scrolling body. */}
          <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t px-5 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {stage === "uploading" ? "Uploading photos…" : stage === "posting" ? "Posting…" : "Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
