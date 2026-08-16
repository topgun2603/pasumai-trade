"use client";

import { TriangleAlertIcon, VideoIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { MediaPicker, type PickedFile } from "@/components/farm/media-picker";
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
import { MAX_IMAGES } from "@/lib/domain/listing-draft";
import type { FarmListing } from "@/lib/firebase/listings-read";

export interface CropOption {
  id: string;
  en: string;
  ta: string;
  unit: string;
}

/**
 * Editing a listing, in full: crop, grades, readiness and media.
 *
 * Two things this has to get right that posting does not.
 *
 * **Existing photographs are paths, new ones are files.** A signed URL expires
 * and cannot be written back, so "keep this one" means keeping its path while
 * the newly picked ones still have to be uploaded. The two are tracked apart
 * and only combined at save.
 *
 * **Someone may be mid-bargain.** A buyer priced against what was on the
 * listing when they opened it, so changing the crop or removing the photograph
 * they were looking at moves the ground under them. The dialog says so; it does
 * not refuse, because the farmer knows what they posted and a typo on the crop
 * would otherwise be permanent.
 *
 * Keyed by listing at the call site, so opening a different row resets the
 * fields rather than carrying the last one's numbers over.
 */
export function EditListingDialog({
  listing,
  crops,
  openBargains = 0,
  onOpenChange,
}: {
  listing: FarmListing | null;
  crops: CropOption[];
  /** Live bargains on this listing, for the warning. */
  openBargains?: number;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={listing !== null} onOpenChange={onOpenChange}>
      {listing ? (
        <Body
          key={listing.id}
          listing={listing}
          crops={crops}
          openBargains={openBargains}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function Body({
  listing,
  crops,
  openBargains,
  onDone,
}: {
  listing: FarmListing;
  crops: CropOption[];
  openBargains: number;
  onDone: () => void;
}) {
  const router = useRouter();

  const [produceId, setProduceId] = useState(listing.produceId);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(listing.grades.map((g) => [g.grade, String(g.quantity)])),
  );
  const [readyIn, setReadyIn] = useState("");

  // Kept media, as {path, url} pairs indexed together by the read layer.
  const [keptImages, setKeptImages] = useState(
    listing.imagePaths.map((path, i) => ({ path, url: listing.imageUrls[i] })),
  );
  const [keptVideo, setKeptVideo] = useState(
    listing.videoPath ? { path: listing.videoPath, url: listing.videoUrl ?? "" } : null,
  );
  const [newImages, setNewImages] = useState<PickedFile[]>([]);
  const [newVideo, setNewVideo] = useState<PickedFile | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");

  const unit = crops.find((c) => c.id === produceId)?.unit ?? listing.unit;
  const busy = stage !== "idle";
  const cropChanged = produceId !== listing.produceId;
  const totalImages = keptImages.length + newImages.length;

  const grades = GRADES.map((grade) => ({
    grade,
    quantity: Number(quantities[grade] ?? "") || 0,
  }));
  const total = grades.reduce((sum, g) => sum + Math.max(0, g.quantity), 0);

  /** Uploads only what is new, and returns the full set of paths. */
  async function uploadNew(): Promise<{ imagePaths: string[]; videoPath?: string } | null> {
    const files = [
      ...newImages.map((i) => ({ kind: "image" as const, file: i.file })),
      ...(newVideo ? [{ kind: "video" as const, file: newVideo.file }] : []),
    ];

    if (files.length === 0) {
      return {
        imagePaths: keptImages.map((i) => i.path),
        videoPath: keptVideo?.path,
      };
    }

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
      setError(data.error ?? "Could not start the upload.");
      return null;
    }

    const results = await Promise.all(
      data.uploads.map(async (upload, index) => {
        const put = await fetch(upload.url, {
          method: "PUT",
          headers: { "content-type": upload.contentType },
          body: files[index].file,
        });
        return put.ok ? upload.path : null;
      }),
    );

    if (results.some((r) => r === null)) {
      setError("Some files did not upload. Check your connection and try again.");
      return null;
    }

    const paths = results as string[];
    return {
      imagePaths: [...keptImages.map((i) => i.path), ...paths.slice(0, newImages.length)],
      // A newly picked video replaces the old one; otherwise whatever is kept.
      videoPath: newVideo ? paths[newImages.length] : keptVideo?.path,
    };
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (grades.every((g) => g.quantity <= 0)) {
      setError("Keep at least one grade. Take it off the market instead of emptying it.");
      return;
    }
    if (grades.some((g) => g.quantity < 0 || g.quantity > 100_000)) {
      setError("Those quantities do not look right.");
      return;
    }
    if (totalImages === 0) {
      setError("Keep at least one photo. Buyers decide on the pictures.");
      return;
    }
    if (totalImages > MAX_IMAGES) {
      setError(`Up to ${MAX_IMAGES} photos.`);
      return;
    }

    setStage("uploading");
    const media = await uploadNew();
    if (!media) {
      setStage("idle");
      return;
    }

    setStage("saving");
    const response = await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        produceId,
        grades: Object.fromEntries(
          grades.filter((g) => g.quantity > 0).map((g) => [g.grade, g.quantity]),
        ),
        ...(readyIn ? { readyIn } : {}),
        imagePaths: media.imagePaths,
        videoPath: media.videoPath ?? null,
      }),
    }).catch(() => null);
    setStage("idle");

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
    <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-lg">
      <DialogHeader className="border-b px-5 py-4">
        <DialogTitle>Edit listing</DialogTitle>
        <DialogDescription>
          Change anything about this lot. There is still no price — that is the bargaining.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={save} noValidate className="contents">
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {openBargains > 0 ? (
            <p className="border-warning/30 bg-warning-soft text-warning flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              {openBargains === 1 ? "A buyer is" : `${openBargains} buyers are`} bargaining on
              this lot right now. They priced against what is here — tell them if you change it.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="produce">Crop</Label>
            <Select value={produceId} onValueChange={setProduceId}>
              <SelectTrigger id="produce">
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
            {cropChanged ? (
              <p className="text-warning text-xs">
                Changing the crop rewrites what every buyer sees in their list.
              </p>
            ) : null}
          </div>

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

          {/* Existing media, each removable. Kept apart from the picker below
              because these are already in storage and those are not yet. */}
          {keptImages.length > 0 || keptVideo ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label>Photos already on this listing</Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {totalImages} of {MAX_IMAGES}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {keptImages.map((image, index) => (
                  <div
                    key={image.path}
                    className="border-border relative aspect-square overflow-hidden rounded-md border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt="" className="size-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() => {
                        setKeptImages((k) => k.filter((x) => x.path !== image.path));
                        setError(null);
                      }}
                      className="bg-background/85 hover:bg-background absolute top-1 right-1 rounded-full p-1"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {keptVideo ? (
                <div className="border-border flex items-center gap-3 rounded-md border p-2">
                  <VideoIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">Video on this listing</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setKeptVideo(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}

              <p className="text-muted-foreground text-xs">
                Removing a photo deletes it. It cannot be brought back.
              </p>
            </div>
          ) : null}

          <MediaPicker
            images={newImages}
            video={newVideo}
            disabled={busy}
            onImages={(next) => {
              // The picker counts its own; the ceiling is across both sets.
              if (keptImages.length + next.length > MAX_IMAGES) {
                setError(`Up to ${MAX_IMAGES} photos in total.`);
                return;
              }
              setNewImages(next);
              setError(null);
            }}
            onVideo={setNewVideo}
            onError={(message) => toast.error(message)}
          />

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
          <Button type="button" variant="outline" disabled={busy} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {stage === "uploading" ? "Uploading…" : stage === "saving" ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
