"use client";

import {
  CameraIcon,
  FileTextIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  readonly id: string;
  readonly name: string;
  /** Bytes after compression. */
  readonly size: number;
  readonly type: string;
  /** Object URL for preview. Revoked when the file is replaced or cleared. */
  readonly previewUrl: string;
}

const MAX_BYTES = 8 * 1024 * 1024;

/** Longest edge after resize. Enough to read a licence, small enough to send. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Resize and re-encode an image in the browser before it is ever uploaded.
 *
 * A modern phone camera produces 4–8 MB per shot. Sending that raw from a
 * village on a 3G connection is slow enough that people abandon registration
 * halfway, and it multiplies storage cost by an order of magnitude at national
 * scale. A 1600px JPEG is still comfortably legible for a document scan.
 *
 * Falls back to the original file if anything goes wrong — a slightly large
 * upload beats a failed one.
 */
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 1024 * 1024) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function useFileSlot(
  value: UploadedFile | null,
  onChange: (file: UploadedFile | null) => void,
) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);

  // Object URLs leak until revoked, and a long registration form can churn
  // through several attempts per field.
  useEffect(() => {
    return () => {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    };
  }, []);

  async function accept(file: File | undefined) {
    if (!file) return;
    setProblem(null);

    if (file.size > MAX_BYTES) {
      setProblem(`${formatBytes(file.size)} is too large — the limit is 8 MB`);
      return;
    }

    setBusy(true);
    const processed = await compressImage(file);

    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    const previewUrl = URL.createObjectURL(processed);
    lastUrl.current = previewUrl;

    onChange({
      id: `${file.name}-${processed.size}`,
      name: file.name,
      size: processed.size,
      type: processed.type || file.type,
      previewUrl,
    });
    setBusy(false);
  }

  function clear() {
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    lastUrl.current = null;
    setProblem(null);
    onChange(null);
  }

  return { busy, problem, accept, clear, value };
}

/**
 * A single photograph, with a preview.
 *
 * `capture="environment"` opens the rear camera directly on a phone, which is
 * how nearly every one of these will actually be taken — in a yard, next to
 * the vehicle, not uploaded from a desktop.
 */
export function PhotoUpload({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  error?: string;
  required?: boolean;
}) {
  const slot = useFileSlot(value, onChange);
  const inputRef = useRef<HTMLInputElement>(null);
  const message = error ?? slot.problem;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-faint text-xs font-normal">optional</span>
        )}
      </Label>

      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed p-3",
          message && "border-destructive/50",
        )}
      >
        {value ? (
          <span className="bg-secondary relative size-16 shrink-0 overflow-hidden rounded-md">
            <Image
              src={value.previewUrl}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          </span>
        ) : (
          <span className="bg-secondary text-faint flex size-16 shrink-0 items-center justify-center rounded-md">
            <CameraIcon className="size-5" />
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {value ? (
            <>
              <span className="truncate text-sm font-medium">{value.name}</span>
              <span className="text-faint tabular text-xs">
                {formatBytes(value.size)} after compression
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">
              {slot.busy ? "Processing…" : "No photo yet"}
            </span>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={slot.busy}
              onClick={() => inputRef.current?.click()}
            >
              {slot.busy ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <CameraIcon className="size-3.5" />
              )}
              {value ? "Replace" : "Take or choose"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={slot.clear}
              >
                <XIcon className="size-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-describedby={message ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => slot.accept(e.target.files?.[0])}
        />
      </div>

      {message ? (
        <p id={`${id}-error`} className="text-destructive flex items-center gap-1 text-xs">
          <TriangleAlertIcon className="size-3 shrink-0" />
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A scan or photograph of a document. Accepts images and PDFs. */
export function DocumentUpload({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  error?: string;
  required?: boolean;
}) {
  const slot = useFileSlot(value, onChange);
  const inputRef = useRef<HTMLInputElement>(null);
  const message = error ?? slot.problem;
  const isImage = value?.type.startsWith("image/");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-faint text-xs font-normal">optional</span>
        )}
      </Label>

      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2.5",
          message && "border-destructive/50",
          !value && "border-dashed",
        )}
      >
        {value && isImage ? (
          <span className="bg-secondary relative size-10 shrink-0 overflow-hidden rounded">
            <Image
              src={value.previewUrl}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          </span>
        ) : (
          <span className="bg-secondary text-faint flex size-10 shrink-0 items-center justify-center rounded">
            <FileTextIcon className="size-4" />
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          {value ? (
            <>
              <span className="truncate text-sm">{value.name}</span>
              <span className="text-faint tabular text-xs">
                {formatBytes(value.size)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">
              {slot.busy ? "Processing…" : "Not attached"}
            </span>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={slot.busy}
            onClick={() => inputRef.current?.click()}
          >
            {slot.busy ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <UploadIcon className="size-3.5" />
            )}
            {value ? "Replace" : "Attach"}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${label}`}
              onClick={slot.clear}
            >
              <XIcon className="size-4" />
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          aria-describedby={message ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => slot.accept(e.target.files?.[0])}
        />
      </div>

      {message ? (
        <p id={`${id}-error`} className="text-destructive flex items-center gap-1 text-xs">
          <TriangleAlertIcon className="size-3 shrink-0" />
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Aadhaar carries a legal obligation the other documents do not.
 *
 * Under the Aadhaar Act and the UIDAI regulations, a private entity that is
 * not an authorised user agency should not be storing full Aadhaar numbers or
 * unmasked Aadhaar images at all. The compliant route is masked Aadhaar —
 * where only the last four digits are visible — or a DigiLocker-issued or
 * offline e-KYC document. This notice sits next to the field so whoever is
 * collecting it knows before they photograph the card.
 */
export function AadhaarNotice() {
  return (
    <p className="border-warning/40 bg-warning-soft text-foreground sm:col-span-2 rounded-md border px-3 py-2 text-xs">
      <span className="font-medium">Upload masked Aadhaar only.</span> The first
      eight digits must be blacked out, or use the DigiLocker or offline e-KYC
      copy. Storing a full Aadhaar image is a compliance risk — only the last
      four digits are ever retained or displayed.
    </p>
  );
}
