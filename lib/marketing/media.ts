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
  /*
    The seven steps of the Farmer Direct Market brief.

    They had their own slots because a four-step section above them drew the
    same photographs, and the page would otherwise have shown each twice. That
    section is gone; these are now the only slots that name them.
  */
  dmList: {
    // The file keeps the deleted section's name. Renaming it would mean
    // renaming the photograph on disk and its row in the photo brief, to
    // gain nothing a reader of this file cannot already see.
    photo: "/marketing/photos/step-list.jpg",
    fallback: "/marketing/dm-list.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "A farmer at the field edge listing a crop on the phone, with the crate of vegetables it refers to in the same frame.",
  },
  dmNegotiate: {
    photo: "/marketing/photos/step-bargain.jpg",
    fallback: "/marketing/dm-negotiate.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "The bargaining screen mid-exchange — an offer and a counter, both visible. A real capture, not a mock-up.",
  },
  /*
    No photograph yet — this slot and `dmApprove` are the two steps in the
    section that nothing in the photo directory covers, so they draw their
    illustration until a file appears. Both are screen moments rather than
    field moments, which is probably why they were never shot.
  */
  dmSecure: {
    photo: "/marketing/photos/dm-secure.jpg",
    fallback: "/marketing/step-secure.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "The confirmation code on a real handset, held over a crate or a ledger. Blur or substitute the characters — a live code is a bearer token for one order.",
  },
  dmTransport: {
    photo: "/marketing/photos/step-delivery.jpg",
    fallback: "/marketing/dm-transport.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "A loaded vehicle on the road with crates visible over the side, so the load reads as produce rather than freight. Only livery it actually carries.",
  },
  /*
    Its own photograph, not `harvest`.

    It borrowed that one for a while — graded crates with the labels legible,
    which looks close enough. It is the wrong moment: `harvest` is grading at
    the *farm gate*, and this step is the buyer opening the load at their own
    gate and deciding whether to accept it. Sharing it also put the same
    picture twice on one page, a section apart.

    Draws its illustration until `dm-check.*` exists.
  */
  dmCheck: {
    photo: "/marketing/photos/dm-check.jpg",
    fallback: "/marketing/dm-check.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "The buyer's own gate: a crate opened, a weighing scale, and the check being written down. This is the step the whole payment turns on, so it wants a real photograph more than any other here.",
  },
  dmApprove: {
    photo: "/marketing/photos/dm-approve.jpg",
    fallback: "/marketing/dm-approve.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "The approval screen at the moment it is tapped, held at the buyer's dock rather than at a desk.",
  },
  dmPayout: {
    // Its own file: a settled-payment screen that was sitting unused in the
    // photo directory under an "-old" name, which is exactly this step.
    photo: "/marketing/photos/dm-payout.jpg",
    fallback: "/marketing/dm-payout.svg",
    aspect: "4 / 3",
    minWidth: 900,
    brief:
      "A farmer with a passbook or a credit message on the handset. The face matters here — this is the end of the sequence and the reason for all of it.",
  },
} as const satisfies Record<string, MediaSlot>;

export type MediaKey = keyof typeof MEDIA;

/**
 * Resolves a slot to whichever asset actually exists.
 *
 * Runs on the server during the static build, so the check costs nothing at
 * request time and the generated HTML already points at the right file.
 */
/**
 * Extensions accepted for a photograph, best first.
 *
 * The slot names one file, but whoever supplies the photography should not
 * have to care which container it lands in — a PNG export from a design tool
 * is as valid as a JPEG from a camera. WebP is preferred where both exist
 * because it is the one worth keeping in the repository.
 */
const EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png", ".avif"];

export function resolveMedia(key: MediaKey): {
  src: string;
  isPhotograph: boolean;
  aspect: string;
} {
  const slot = MEDIA[key];
  const base = slot.photo.replace(/.[a-z0-9]+$/i, "");

  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(join(process.cwd(), "public", candidate))) {
      return { src: candidate, isPhotograph: true, aspect: slot.aspect };
    }
  }

  return { src: slot.fallback, isPhotograph: false, aspect: slot.aspect };
}
