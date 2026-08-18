"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageOffIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The evidence behind a check, small enough to scan and large enough to judge.
 *
 * Two sizes on purpose. The strip is for an operator working down a queue: a
 * row of thumbnails they can swipe or scroll past without leaving the page. The
 * dialog is for the one they stopped on — an identity document is refused over
 * a digit, and a digit is not legible at 96 pixels.
 *
 * Signed URLs, minted per render and good for fifteen minutes. Nothing here
 * caches them: a dialog opened an hour after the page loaded will fail to load
 * the image rather than show a stale one, and a refresh fixes it. That is the
 * right trade for photographs of somebody's Aadhaar.
 *
 * PDFs are shown as a labelled tile rather than rendered. A GST certificate
 * arrives as a download and refusing it would push the applicants with the
 * cleanest evidence towards screenshots; embedding a viewer for it is a
 * dependency this page does not need when the browser already has one behind a
 * link.
 */

export interface ViewableDocument {
  readonly url: string;
  readonly contentType: string;
  /** Pre-formatted on the server, so the two renders agree. */
  readonly uploadedLabel: string;
}

function isPdf(document: ViewableDocument) {
  return document.contentType === "application/pdf";
}

export function DocumentStrip({
  documents,
  label,
  emptyNote,
}: {
  documents: readonly ViewableDocument[];
  /** What these are of, e.g. "PAN". Read out per slide. */
  label: string;
  /** Shown when there is nothing, so a missing upload is visibly missing. */
  emptyNote?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (documents.length === 0) {
    return emptyNote ? (
      <span className="text-faint flex items-center gap-1.5 text-xs">
        <ImageOffIcon className="size-3.5" />
        {emptyNote}
      </span>
    ) : null;
  }

  return (
    <>
      {/*
        A scroller rather than a grid. Four documents across an already narrow
        queue row would shrink each to a stamp; scrolling keeps every thumbnail
        the same size whether there is one of them or six.
      */}
      <div
        className="flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={`${label} — ${documents.length} file${documents.length === 1 ? "" : "s"}`}
      >
        {documents.map((document, i) => (
          <button
            key={document.url}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open ${label} ${i + 1} of ${documents.length}`}
            className="border-border bg-card hover:border-primary focus-visible:ring-ring relative size-24 shrink-0 snap-start overflow-hidden rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {isPdf(document) ? (
              <span className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1">
                <FileTextIcon className="size-6" />
                <span className="text-[10px]">PDF</span>
              </span>
            ) : (
              /* A signed, short-lived storage URL. next/image would need the
                 host allow-listed and would cache a URL that expires within the
                 quarter-hour. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={document.url}
                alt={`${label} ${i + 1} of ${documents.length}`}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="size-full object-cover"
              />
            )}
            {documents.length > 1 ? (
              <span className="bg-background/85 pointer-events-none absolute right-1 bottom-1 rounded px-1 text-[10px] tabular-nums">
                {i + 1}/{documents.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <DocumentViewer
        documents={documents}
        label={label}
        index={open}
        onIndex={setOpen}
      />
    </>
  );
}

/**
 * One document, as large as the window allows.
 *
 * Paging lives here rather than in the strip because the operator's next
 * question after "is this legible" is "what does the other side say", and
 * closing the dialog to click the neighbouring thumbnail loses their place in
 * a queue that may be forty rows long.
 */
function DocumentViewer({
  documents,
  label,
  index,
  onIndex,
}: {
  documents: readonly ViewableDocument[];
  label: string;
  index: number | null;
  onIndex: (index: number | null) => void;
}) {
  const open = index !== null;

  /*
    Arrow keys page the document. Radix handles Escape and the focus trap; it
    has no opinion about left and right, and a reviewer looking at both sides of
    an Aadhaar card reaches for those before the mouse.
  */
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      onIndex(Math.max(0, Math.min(documents.length - 1, (index ?? 0) + step)));
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, documents.length, onIndex]);

  if (index === null) return null;
  const current = documents[index];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onIndex(null))}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-3 sm:max-w-3xl">
        <DialogTitle className="text-base">
          {label}
          {documents.length > 1 ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              — {index + 1} of {documents.length}
            </span>
          ) : null}
        </DialogTitle>
        <DialogDescription>Uploaded {current.uploadedLabel}</DialogDescription>

        <div className="bg-secondary relative flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-md">
          {isPdf(current) ? (
            <span className="text-muted-foreground flex flex-col items-center gap-3 p-8 text-center text-sm">
              <FileTextIcon className="size-8" />
              A PDF. Open it to read it — the browser has a viewer for this.
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={`${label} ${index + 1} of ${documents.length}`}
              className="max-h-[70svh] w-auto max-w-full object-contain"
            />
          )}

          {documents.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous"
                disabled={index === 0}
                onClick={() => onIndex(index - 1)}
                className="bg-background/85 hover:bg-background focus-visible:ring-ring absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full shadow-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-0"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                disabled={index === documents.length - 1}
                onClick={() => onIndex(index + 1)}
                className="bg-background/85 hover:bg-background focus-visible:ring-ring absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full shadow-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-0"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Every thumbnail again, so paging is not the only way across. */}
          <div className="flex gap-1.5 overflow-x-auto">
            {documents.map((document, i) => (
              <button
                key={document.url}
                type="button"
                aria-label={`Show ${i + 1} of ${documents.length}`}
                aria-current={i === index}
                onClick={() => onIndex(i)}
                className={cn(
                  "size-10 shrink-0 overflow-hidden rounded border transition-colors",
                  i === index ? "border-primary" : "border-border opacity-60",
                )}
              >
                {isPdf(document) ? (
                  <span className="text-muted-foreground flex size-full items-center justify-center">
                    <FileTextIcon className="size-4" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={document.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>

          {/*
            `noreferrer` matters here beyond habit: the signed URL is the whole
            credential, and it would otherwise travel to the storage host as a
            referrer on anything the opened tab loads.
          */}
          <Button asChild variant="outline" size="sm">
            <a href={current.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-3.5" />
              Open full size
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
