"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A crop's icon.
 *
 * Two ways to set one, because they serve different cases: an emoji is
 * instant, free and works for common crops, while an uploaded image is the
 * only option for a crop no emoji covers — which is most of them once the
 * catalogue grows past the supermarket staples.
 *
 * Uploaded icons are stored **on the produce document as a data URI**, not in
 * Cloud Storage. At 128px WebP an icon lands around 3–6 KB, so it costs less
 * than the round trip to fetch it would, renders with no second request, and
 * avoids public buckets and signed-URL expiry entirely. That reasoning holds
 * for icons and nowhere else — a photograph belongs in Storage.
 */

/** Produce emoji, grouped so the picker is scannable rather than a wall. */
const EMOJI_GROUPS: Array<{ label: string; emoji: string[] }> = [
  {
    label: "Vegetables",
    emoji: ["🍅", "🥔", "🧅", "🧄", "🥕", "🍆", "🥒", "🫑", "🌶️", "🥬", "🥦", "🌽", "🎃", "🍠", "🫛"],
  },
  {
    label: "Fruit",
    emoji: ["🍌", "🥭", "🍇", "🍉", "🍈", "🍊", "🍋", "🍍", "🥥", "🍎", "🍐", "🍑", "🍓", "🫐", "🥝"],
  },
  {
    label: "Grain and pulses",
    emoji: ["🌾", "🍚", "🥜", "🫘", "🌻", "🥖"],
  },
  {
    label: "Other",
    emoji: ["🌿", "🍀", "🟡", "🫚", "🍄", "🥚", "🧉"],
  },
];

const ICON_PX = 128;
const QUALITY = 0.82;

/**
 * Resize to a square icon and re-encode as WebP.
 *
 * Cover-crops to square so a wide photograph does not letterbox into a
 * mostly-empty tile. WebP because at this size it is roughly half the bytes
 * of JPEG with no visible difference.
 */
async function toIconDataUri(file: File): Promise<string> {
  // `from-image` applies EXIF orientation. Without it a photo taken on a phone
  // held sideways arrives rotated, which is most photos taken in a field.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    ICON_PX,
    ICON_PX,
  );
  bitmap.close();

  // A browser that cannot encode the requested type silently returns PNG, and
  // a 128px PNG of a photograph can be several times the size of the WebP it
  // was meant to be. Fall back to JPEG in that case rather than to a PNG that
  // may not fit the field's budget.
  const webp = canvas.toDataURL("image/webp", QUALITY);
  if (webp.startsWith("data:image/webp")) return webp;

  return canvas.toDataURL("image/jpeg", QUALITY);
}

/** Renders whichever icon a crop has, image first. */
export function CropIcon({
  emoji,
  iconUrl,
  name,
  size = "md",
}: {
  emoji?: string;
  iconUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = {
    sm: "size-6 text-base",
    md: "size-9 text-xl",
    lg: "size-14 text-3xl",
  }[size];

  if (iconUrl) {
    return (
      // Data URI of known small size — `next/image` would add a round trip
      // through the optimizer for no benefit.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt={`${name} icon`}
        className={cn("shrink-0 rounded-md object-cover", box)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "bg-secondary flex shrink-0 items-center justify-center rounded-md",
        box,
      )}
    >
      {emoji || "🌱"}
    </span>
  );
}

export function IconPicker({
  emoji,
  iconUrl,
  name,
  onChange,
  error,
}: {
  emoji: string;
  iconUrl: string | null;
  name: string;
  onChange: (next: { emoji: string; iconUrl: string | null }) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function accept(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      const dataUri = await toIconDataUri(file);
      if (dataUri.length > 64 * 1024) {
        setProblem("That image is too detailed to shrink. Try a simpler one.");
      } else {
        // An uploaded icon wins over the emoji, but the emoji is kept so
        // removing the image falls back rather than leaving nothing.
        onChange({ emoji, iconUrl: dataUri });
      }
    } catch {
      setProblem("That file could not be read as an image.");
    }
    setBusy(false);
  }

  const message = error ?? problem;

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <Label className="text-sm">
        Icon
        <span className="text-destructive" aria-hidden>
          *
        </span>
      </Label>

      <div className="flex items-center gap-3">
        <CropIcon emoji={emoji} iconUrl={iconUrl} name={name || "crop"} size="lg" />

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <ImagePlusIcon className="size-3.5" />
              )}
              {iconUrl ? "Replace image" : "Upload image"}
            </Button>
            {iconUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ emoji, iconUrl: null })}
              >
                <XIcon className="size-3.5" />
                Use emoji
              </Button>
            ) : null}
          </div>
          <p className="text-faint text-xs">
            {iconUrl
              ? "Uploaded image, resized to 128px WebP"
              : "Pick an emoji below, or upload an image for a crop none covers"}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>

      <div
        className={cn(
          "max-h-44 overflow-y-auto rounded-lg border p-2",
          iconUrl && "opacity-50",
        )}
      >
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="mb-2 last:mb-0">
            <p className="text-faint px-1 pb-1 text-xs">{group.label}</p>
            <div className="flex flex-wrap gap-1">
              {group.emoji.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={option}
                  aria-pressed={!iconUrl && emoji === option}
                  onClick={() => onChange({ emoji: option, iconUrl: null })}
                  className={cn(
                    "hover:bg-secondary focus-visible:ring-ring flex size-9 items-center justify-center rounded-md text-xl focus-visible:ring-2 focus-visible:outline-none",
                    !iconUrl && emoji === option && "bg-accent ring-primary ring-2",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {message ? <p className="text-destructive text-xs">{message}</p> : null}
    </div>
  );
}
