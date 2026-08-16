/**
 * Media slides, shaped for the carousel.
 *
 * Deliberately in its own module with no `"use client"` on it. A plain function
 * exported from a client module cannot be *called* from the server — React
 * hands back a reference that only works as a component or a prop — so keeping
 * this next to the carousel meant every server component rendering media threw
 * at runtime. The type could have stayed (types are erased); the function could
 * not.
 */

export interface CarouselItem {
  readonly kind: "image" | "video";
  readonly url: string;
  /** Still frame for a video, when one is available. */
  readonly poster?: string;
}

/** Builds the slide list from a listing's media: photographs first, video last. */
export function mediaItems(
  imageUrls: readonly string[],
  videoUrl?: string,
): CarouselItem[] {
  return [
    ...imageUrls.map((url): CarouselItem => ({ kind: "image", url })),
    // Last, deliberately. The first slide is what a buyer sees in a list, and
    // a video that has to load before it means anything is a worse first
    // impression than a photograph.
    ...(videoUrl ? [{ kind: "video" as const, url: videoUrl }] : []),
  ];
}
