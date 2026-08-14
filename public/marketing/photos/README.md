# Landing page photography

Drop real photographs in this folder and they replace the illustrations
automatically. Nothing else needs changing — `lib/marketing/media.ts` checks
for each file at build time and falls back to the drawing when it is absent.

| File | Aspect | Min width | What to shoot |
|---|---|---|---|
| `hero.jpg` | 8:5.6 (landscape) | 1600px | Cultivated field foreground, collection shed and a loaded vehicle mid-ground. Morning light. |
| `harvest.jpg` | 7:5 | 1200px | Graded produce in crates at a collection point, weighing scale and inspection sheet visible. Grade labels legible. |
| `console.jpg` | 7:5 | 1200px | Screenshot of the buyer console at `/market` on a wide window with stock loaded. Crop to the content area. |

## Before you shoot

- **Get written consent** from anyone identifiable in frame, farmers included.
  A signed release, not a verbal yes.
- Shoot **landscape**, and leave room at the edges — the frames crop with
  `object-cover` and the exact crop shifts between breakpoints.
- Avoid text in the image. It cannot be translated, and this page renders in
  six languages.

## Export

JPEG or WebP, quality ~80, sRGB. Do not pre-resize below the minimum width —
Next's image optimizer generates the smaller sizes and modern formats, and it
cannot invent detail you removed.

Strip EXIF GPS before committing. Farm coordinates are not ours to publish.

## Why not stock photography

Generic stock undermines the point of the page. A buyer deciding whether to
trust a produce platform is looking for evidence that these crates, this
collection point and these vehicles actually exist — and stock imagery
reliably signals the opposite.
