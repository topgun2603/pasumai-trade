"use client";

import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon, PlayIcon } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The one carousel.
 *
 * Built on CSS scroll-snap rather than a carousel library, for three reasons
 * that matter on the surface this was written for — a farmer's phone on a
 * village connection. Touch, momentum and rubber-banding are the browser's own
 * and cost nothing; it degrades to a plain horizontal scroller if JavaScript is
 * slow to arrive; and it adds no kilobytes to a bundle that budget Android
 * hardware already parses slowly.
 *
 * The buttons and dots drive `scrollTo`. They are a convenience for a mouse —
 * the scroller works with a thumb whether or not React has hydrated.
 *
 * Videos are a slide like any other, not a special mode. A farmer who filmed
 * the lot expects it in the same swipe as the photographs.
 */

export interface CarouselItem {
  readonly kind: "image" | "video";
  readonly url: string;
  /** Still frame for a video, when one is available. */
  readonly poster?: string;
}

export function Carousel({
  items,
  alt,
  className,
  aspect = "aspect-[4/3]",
  rounded = "rounded-md",
  compact = false,
}: {
  items: readonly CarouselItem[];
  /** Describes the subject, e.g. the crop. Indices are appended per slide. */
  alt: string;
  className?: string;
  aspect?: string;
  rounded?: string;
  /**
   * Thumbnail sizing: keep the swipe and the counter, drop the arrows and
   * dots. At around a hundred pixels a 28px button covers a third of the
   * photograph, and the controls end up competing with the thing they are
   * meant to reveal.
   */
  compact?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "bg-secondary text-muted-foreground flex items-center justify-center",
          aspect,
          rounded,
          className,
        )}
      >
        <ImageOffIcon className="size-6" />
      </div>
    );
  }

  const single = items.length === 1;

  /** Which slide is under the viewport, from the scroll offset. */
  function onScroll() {
    const el = track.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    // Guarded so a scroll that lands on the same slide does not re-render on
    // every frame of a momentum flick.
    if (next !== index && next >= 0 && next < items.length) setIndex(next);
  }

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, to));
    el.scrollTo({
      left: clamped * el.clientWidth,
      // Honouring the system setting: an animated slide is exactly the motion
      // somebody turns that off to avoid.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    setIndex(clamped);
  }

  return (
    <div
      className={cn("group/carousel relative", className)}
      role="group"
      aria-roledescription="carousel"
      aria-label={alt}
    >
      <div
        ref={track}
        onScroll={onScroll}
        // Arrow keys work when the track has focus, which is what a keyboard
        // user reaches for first. `tabIndex` because a scroll container is only
        // focusable in some browsers by default.
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(index + 1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(index - 1);
          }
        }}
        className={cn(
          "focus-visible:ring-ring flex snap-x snap-mandatory overflow-x-auto scroll-smooth focus-visible:ring-2 focus-visible:outline-none",
          // The scrollbar is noise under a photograph; the dots say where you
          // are.
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          aspect,
          rounded,
        )}
      >
        {items.map((item, i) => (
          <div
            key={`${item.url}-${i}`}
            className="bg-secondary relative w-full shrink-0 snap-center"
            role="group"
            aria-roledescription="slide"
            aria-label={`${alt} — ${i + 1} of ${items.length}`}
          >
            {item.kind === "video" ? (
              <video
                src={item.url}
                poster={item.poster}
                controls
                playsInline
                // Metadata only: a video nobody plays should not cost a farmer
                // their data allowance for the privilege of appearing in a list.
                preload="metadata"
                className="size-full bg-black object-contain"
              />
            ) : (
              /* A signed, short-lived storage URL. next/image would need the
                 host allow-listed and would cache a URL that expires within
                 the hour. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={`${alt} — ${i + 1} of ${items.length}`}
                // The first slide is what the page is about; the rest wait
                // until they are scrolled towards.
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                className="size-full object-cover"
              />
            )}

            {item.kind === "video" && items.length > 1 ? (
              <span className="bg-background/85 pointer-events-none absolute top-2 left-2 rounded p-1">
                <PlayIcon className="size-3" />
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {!single && !compact ? (
        <>
          {/*
            Visible on hover and on focus, always visible on touch — where
            there is no hover and a swipe is the real control anyway, so they
            sit quietly rather than being hidden behind an interaction that
            does not exist.
          */}
          <button
            type="button"
            aria-label="Previous"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="bg-background/85 hover:bg-background focus-visible:ring-ring absolute top-1/2 left-1.5 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full shadow-sm transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:opacity-0 sm:flex sm:opacity-0 group-hover/carousel:sm:opacity-100 group-focus-within/carousel:sm:opacity-100"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => go(index + 1)}
            disabled={index === items.length - 1}
            className="bg-background/85 hover:bg-background focus-visible:ring-ring absolute top-1/2 right-1.5 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full shadow-sm transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:opacity-0 sm:flex sm:opacity-0 group-hover/carousel:sm:opacity-100 group-focus-within/carousel:sm:opacity-100"
          >
            <ChevronRightIcon className="size-4" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={`dot-${item.url}-${i}`}
                type="button"
                aria-label={`Go to ${i + 1} of ${items.length}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={cn(
                  "pointer-events-auto size-1.5 rounded-full transition-all",
                  i === index ? "bg-background w-4" : "bg-background/60",
                )}
              />
            ))}
          </div>

        </>
      ) : null}

      {/* The counter survives compact: on a thumbnail it is the only thing
          saying there is more than one photograph. */}
      {!single ? (
        <span
          className={cn(
            "bg-background/85 pointer-events-none absolute rounded tabular-nums",
            compact ? "right-1 bottom-1 px-1 text-[10px]" : "top-2 right-2 px-1.5 text-[11px]",
          )}
        >
          {index + 1}/{items.length}
        </span>
      ) : null}
    </div>
  );
}

/** Builds the slide list from a listing's media: photographs first, video last. */
export function mediaItems(imageUrls: readonly string[], videoUrl?: string): CarouselItem[] {
  return [
    ...imageUrls.map((url): CarouselItem => ({ kind: "image", url })),
    // Last, deliberately. The first slide is what a buyer sees in a list, and
    // a video that has to load before it means anything is a worse first
    // impression than a photograph.
    ...(videoUrl ? [{ kind: "video" as const, url: videoUrl }] : []),
  ];
}
