import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Photography slots on the public site.
 *
 * Every slot names a **real photograph** first and an illustration second.
 * At build time the real file is used if it is present, otherwise the drawing
 * stands in — so adding photography is a matter of dropping files into
 * `public/marketing/photos/` with the right names. No code changes, no
 * redeploy of anything but the assets.
 *
 * Photographs beat illustrations here for a specific reason rather than a
 * general one: a buyer deciding whether to trust a produce platform is
 * looking for evidence that the crates, the farms and the vehicles
 * actually exist. A drawing cannot supply that.
 *
 * Shoot notes are recorded against each slot so whoever takes them knows the
 * crop, the framing and the aspect ratio the layout expects.
 */
export interface MediaSlot {
  /** Preferred real photograph, relative to `public/`. */
  readonly photo: string;
  /** Illustration used until the photograph exists. */
  readonly fallback: string;
  /** What the layout reserves. Photographs should be shot to match. */
  readonly aspect: string;
  /** Minimum sensible pixel width, for whoever exports the files. */
  readonly minWidth: number;
  /** Guidance for the shoot. */
  readonly brief: string;
}

export const MEDIA = {
  hero: {
    photo: "/marketing/photos/hero.jpg",
    fallback: "/marketing/hero.svg",
    aspect: "8 / 5.6",
    minWidth: 1600,
    brief:
      "Wide landscape: cultivated field in the foreground, collection shed and a loaded vehicle mid-ground. Shot in morning light, landscape orientation.",
  },
  harvest: {
    photo: "/marketing/photos/harvest.jpg",
    fallback: "/marketing/harvest.svg",
    aspect: "7 / 5",
    minWidth: 1200,
    brief:
      "Graded produce in crates at the farm gate, with the weighing scale and inspection sheet visible. Grade labels should be legible.",
  },
  console: {
    photo: "/marketing/photos/console.jpg",
    fallback: "/marketing/console.svg",
    aspect: "7 / 5",
    minWidth: 1200,
    brief:
      "A real screenshot of the buyer console at /market, taken on a wide window with stock loaded. Crop to the content area.",
  },
  /* From the design sheet ------------------------------------------------ */

  /**
   * The farmer in the hero, cut out against the landscape.
   *
   * Wants a real person who has agreed to appear, not stock. A produce
   * platform asking farmers for trust cannot open with someone who was paid to
   * pose — and anyone in the districts we operate in will know the difference.
   */
  heroFarmer: {
    photo: "/marketing/photos/hero-farmer.jpg",
    fallback: "/marketing/hero-farmer.svg",
    aspect: "3 / 4",
    minWidth: 1200,
    brief:
      "Portrait, standing, arms crossed, waist up, facing camera. Shot against the field so the background can be blurred out. Morning light. Needs a signed release.",
  },
  heroLandscape: {
    photo: "/marketing/photos/hero-landscape.jpg",
    fallback: "/marketing/hero.svg",
    aspect: "16 / 7",
    minWidth: 2000,
    brief:
      "Wide cultivated field receding to hills, rows leading away from camera. Used behind the hero at low contrast, so avoid a busy horizon.",
  },
  stepList: {
    photo: "/marketing/photos/step-list.jpg",
    fallback: "/marketing/harvest.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief: "A farmer holding a phone at the field edge, listing a crop.",
  },
  stepBargain: {
    photo: "/marketing/photos/step-bargain.jpg",
    fallback: "/marketing/console.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "Hands holding a phone showing the bargaining screen with grade prices. Screen must be a real capture, not a mock-up — a fake interface in a photograph is the one thing people always spot.",
  },
  stepDelivery: {
    photo: "/marketing/photos/step-delivery.jpg",
    fallback: "/marketing/step-delivery.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "A loaded goods vehicle on a rural road. Only livery it actually carries — a painted-on logo that does not exist is a claim, not a photograph.",
  },
  stepSettle: {
    photo: "/marketing/photos/step-settle.jpg",
    fallback: "/marketing/step-settle.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "Close on hands and a seedling in soil, or a farmer with a passbook. Warm, shallow depth of field.",
  },
} as const satisfies Record<string, MediaSlot>;

export type MediaKey = keyof typeof MEDIA;

/**
 * Resolves a slot to whichever asset actually exists.
 *
 * Runs on the server during the static build, so the check costs nothing at
 * request time and the generated HTML already points at the right file.
 */
export function resolveMedia(key: MediaKey): {
  src: string;
  isPhotograph: boolean;
  aspect: string;
} {
  const slot = MEDIA[key];
  const onDisk = join(process.cwd(), "public", slot.photo);
  const hasPhoto = existsSync(onDisk);

  return {
    src: hasPhoto ? slot.photo : slot.fallback,
    isPhotograph: hasPhoto,
    aspect: slot.aspect,
  };
}
