"use client";

import { CameraIcon, CheckIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The photograph on an account, and the way to change it.
 *
 * One component for every role. A farmer's account page, an agency's profile
 * and whatever the buying console grows are the same job — show what is there,
 * let somebody replace it — and three implementations of that is three places
 * for the validation to drift apart.
 *
 * ## Why it holds a preview rather than uploading on pick
 *
 * Choosing a file is not the same as deciding. On a phone the camera opens,
 * takes the shot and hands it straight back, and the first look anybody gets
 * at the photograph is the one this shows. Uploading immediately would mean
 * the way to undo a bad photograph is to take another, and every attempt would
 * be stored. So: pick, look, then Save or Cancel.
 *
 * The preview is a blob URL, revoked when it is replaced or dropped — without
 * that, taking six photographs leaks six decoded images for as long as the
 * page is open, which on a low-end handset is the difference between working
 * and not.
 */

/** Matches the endpoint. Checked here so a bad pick fails instantly, offline. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 8 * 1024 * 1024;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

export function ProfilePhoto({
  name,
  photoUrl,
  className,
}: {
  /** Whose it is. Used for the placeholder and the alt text. */
  name: string;
  /** Already signed by the server — a storage path will not load. */
  photoUrl?: string;
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [chosen, setChosen] = useState<{ file: File; preview: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function drop() {
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen(null);
    // Lets the same file be picked again after a cancel. Without it the input
    // holds the old value and the change event never fires.
    if (input.current) input.current.value = "";
  }

  function pick(file: File | undefined) {
    if (!file) return;

    if (!ACCEPTED.includes(file.type.toLowerCase())) {
      toast.error("That is not a photograph", {
        description: "Choose a JPEG, PNG or WebP image.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That photograph is too large", {
        description: "One from a phone camera is well under the 8 MB limit.",
      });
      return;
    }

    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen({ file, preview: URL.createObjectURL(file) });
  }

  async function save() {
    if (!chosen) return;
    setSaving(true);

    try {
      // Ask for somewhere to put it. The path is the server's to choose.
      const signed = await fetch("/api/account/photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: chosen.file.type, bytes: chosen.file.size }),
      });
      if (!signed.ok) {
        const detail = (await signed.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? "Could not prepare the upload.");
      }
      const { path, url } = (await signed.json()) as { path: string; url: string };

      // Straight to storage, not through our server.
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": chosen.file.type },
        body: chosen.file,
      });
      if (!put.ok) throw new Error("The photograph did not finish uploading.");

      // Only now does the account point at it.
      const saved = await fetch("/api/account/photo", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!saved.ok) {
        const detail = (await saved.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? "Could not save the photograph.");
      }

      drop();
      toast.success("Photograph updated");
      router.refresh();
    } catch (error) {
      toast.error("Not saved", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const showing = chosen?.preview ?? photoUrl;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="bg-secondary relative size-20 shrink-0 overflow-hidden rounded-full">
        {showing ? (
          <Image
            src={showing}
            alt={`Photograph of ${name}`}
            fill
            // Signed storage URLs and blob previews are both outside the
            // optimiser's remit.
            unoptimized
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="text-muted-foreground flex size-full items-center justify-center text-xl font-medium"
          >
            {initials(name)}
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-medium">Photograph</span>

        <input
          ref={input}
          id="account-photo"
          type="file"
          // `capture` opens the rear camera on a handset instead of a file
          // browser, which is how most of these will be taken.
          accept={ACCEPTED.join(",")}
          capture="environment"
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />

        {chosen ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              <CheckIcon className="size-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={drop}
              disabled={saving}
            >
              <XIcon className="size-4" />
              Cancel
            </Button>
            <span className="text-faint text-xs">Not saved yet</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => input.current?.click()}
            >
              <CameraIcon className="size-4" />
              {photoUrl ? "Change photograph" : "Add a photograph"}
            </Button>
            <span className="text-faint text-xs">JPEG, PNG or WebP, up to 8 MB</span>
          </div>
        )}
      </div>
    </div>
  );
}
