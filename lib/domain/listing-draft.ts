import { GRADES, QUANTITY_UNITS, type Grade, type QuantityUnit } from "./enums";

/**
 * What a farmer posts, before it is a listing.
 *
 * Two things this shape insists on, both learned from how the trade actually
 * works:
 *
 * **Grades are listed separately.** A farmer cutting tomatoes does not have
 * "800 kg of tomatoes", they have 300 kg that will pass as A, 400 as B and
 * some C. Forcing one number and grading it later at the farm gate is how a
 * price agreed on the phone becomes an argument on the loading bay. So each
 * grade carries its own quantity, and any subset is valid — plenty of farmers
 * have only B, and being made to type a zero into A and C to say so is the
 * kind of form people give up on.
 *
 * **Photographs are the listing.** A buyer three districts away is deciding on
 * pictures. Five is the cap because the sixth adds nothing a buyer reads and
 * every one of them is uploaded over a village connection.
 */

export interface GradeQuantity {
  readonly grade: Grade;
  /** In the listing's unit. Omitted or zero means "none of this grade". */
  readonly quantity: number;
  /**
   * What the farmer is asking, per unit, in paise. Optional.
   *
   * An asking price, not a price. It does not settle anything — a buyer still
   * has to offer and the farmer still has to accept, and the bargain decides.
   * What it does is stop the farmer negotiating from nowhere: someone with no
   * number in front of them is anchored by whatever the first buyer says, and
   * that was the thing this platform was built to remove.
   *
   * Per grade, because a lot of A and a lot of C are two different sales.
   * Leaving it out is allowed and means "make me an offer".
   */
  readonly askingRate?: number;
}

export interface ListingDraft {
  readonly produceId: string;
  /**
   * How this lot is measured.
   *
   * Chosen by the farmer, not fixed by the crop. The catalogue's default is a
   * sensible starting point and no more — the same tomatoes are sold by the
   * kilo at a farm gate and by the crate to a wholesaler, and forcing one on
   * somebody makes them do arithmetic to enter their own stock.
   */
  readonly unit: QuantityUnit;
  readonly grades: readonly GradeQuantity[];
  readonly readyIn: string;
  readonly imagePaths: readonly string[];
  readonly videoPath?: string;
}

export function isQuantityUnit(value: string): value is QuantityUnit {
  return value in QUANTITY_UNITS;
}

/**
 * A sane ceiling on an asking price: one lakh rupees per unit.
 *
 * Not a rule about produce, a rule about the decimal point. Rates are entered
 * in rupees and stored in paise, and the likeliest error by far is a factor of
 * a hundred in either direction.
 */
export const MAX_RATE_PAISE = 100_000 * 100;

/* -------------------------------------------------------------------------
   Media limits
   ------------------------------------------------------------------------- */

export const MAX_IMAGES = 5;

/**
 * Thirty seconds.
 *
 * Long enough to walk a phone down a row and show the crop, short enough to
 * upload on a 3G connection in a field. It is enforced in the browser, where
 * the duration can actually be read; the server enforces a size ceiling
 * instead, because reading a duration server-side needs ffmpeg and a video
 * pipeline this platform does not have. So the honest statement is: the
 * browser stops a long video, and the size cap stops the abuse case.
 */
export const MAX_VIDEO_SECONDS = 30;

/** Roughly a 30-second phone clip at a sane bitrate, with room to spare. */
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;

/** What phones actually record. HEVC in an MP4 container is an iPhone default. */
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export function isImageType(type: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

export function isVideoType(type: string): boolean {
  return (VIDEO_TYPES as readonly string[]).includes(type);
}

/* -------------------------------------------------------------------------
   Validation
   ------------------------------------------------------------------------- */

export type DraftErrors = Partial<
  Record<"produce" | "unit" | "grades" | "rates" | "images" | "video", string>
>;

/** A quantity that is a real number of kilos and not a typo or a fraction of one. */
function badQuantity(value: number): string | undefined {
  if (!Number.isFinite(value) || value < 0) return "must be a number";
  // An extra zero on a phone keypad is the likeliest way this goes wrong.
  if (value > 100_000) return "looks like a typo";
  return undefined;
}

export function validateDraft(draft: ListingDraft): DraftErrors {
  const errors: DraftErrors = {};

  if (!draft.produceId) errors.produce = "Choose what you are selling.";
  if (!isQuantityUnit(draft.unit)) errors.unit = "Choose how it is measured.";

  const priced = draft.grades.filter((g) => g.quantity > 0);

  if (priced.length === 0) {
    errors.grades =
      "Enter how much you have of at least one grade. You do not need all three.";
  } else {
    const wrong = draft.grades.find((g) => badQuantity(g.quantity));
    if (wrong) {
      errors.grades = `Grade ${wrong.grade.toUpperCase()} ${badQuantity(wrong.quantity)}.`;
    } else if (draft.grades.some((g) => !GRADES.includes(g.grade))) {
      errors.grades = "Unknown grade.";
    }
  }

  /*
    Asking prices, where one was given.

    Only checked for sanity — a rate that is absent is not an error, and a rate
    the platform thinks is low is not one either. A farmer clearing a glut at a
    price nobody else would take is still their decision to make.
  */
  const badRate = priced.find(
    (g) =>
      g.askingRate !== undefined &&
      (!Number.isFinite(g.askingRate) ||
        g.askingRate <= 0 ||
        g.askingRate > MAX_RATE_PAISE ||
        !Number.isInteger(g.askingRate)),
  );
  if (badRate) {
    errors.rates = `Check the price on grade ${badRate.grade.toUpperCase()}.`;
  }

  if (draft.imagePaths.length === 0) {
    // Not a nicety. A listing with no photograph is one no buyer three
    // districts away will bid on, so it would sit unanswered and read to the
    // farmer as "the platform does not work".
    errors.images = "Add at least one photo. Buyers decide on the pictures.";
  } else if (draft.imagePaths.length > MAX_IMAGES) {
    errors.images = `Up to ${MAX_IMAGES} photos.`;
  }

  return errors;
}

export function hasDraftErrors(errors: DraftErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** Everything on offer, across the grades that have any. */
export function totalQuantity(grades: readonly GradeQuantity[]): number {
  return grades.reduce((sum, g) => sum + (g.quantity > 0 ? g.quantity : 0), 0);
}

/** Only the grades actually being offered, best first. */
export function offeredGrades(grades: readonly GradeQuantity[]): GradeQuantity[] {
  return GRADES.flatMap((grade) => {
    const found = grades.find((g) => g.grade === grade);
    if (!found || found.quantity <= 0) return [];
    // Spread rather than rebuilt: this used to construct `{grade, quantity}`
    // and silently drop everything else on the entry, which threw away the
    // asking price on the way to being stored.
    return [{ ...found, grade, quantity: found.quantity }];
  });
}

/** "300 kg A · 400 kg B" — how a listing reads in a row. */
export function describeGrades(grades: readonly GradeQuantity[], unit: string): string {
  return offeredGrades(grades)
    .map((g) => `${g.quantity} ${unit} ${g.grade.toUpperCase()}`)
    .join(" · ");
}

/** Rupees as typed, to whole paise. `"26.50"` becomes 2650. */
export function rupeesToPaise(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const rupees = Number(trimmed);
  if (!Number.isFinite(rupees) || rupees <= 0) return undefined;
  // Rounded rather than truncated: ₹26.555 typed into a phone should be 2656,
  // not 2655, and a fraction of a paisa cannot exist downstream anyway.
  return Math.round(rupees * 100);
}

/** Paise back to a plain rupee string for an input. 2650 becomes `"26.5"`. */
export function paiseToRupees(paise: number | undefined): string {
  if (paise === undefined) return "";
  return String(paise / 100);
}

/** "₹26/kg for A" — the asking price as it reads in a row. */
export function describeAsking(
  grades: readonly GradeQuantity[],
  unit: string,
  format: (paise: number) => string,
): string {
  const priced = offeredGrades(grades).filter((g) => g.askingRate !== undefined);
  if (priced.length === 0) return "";
  return priced
    .map((g) => `${g.grade.toUpperCase()} ${format(g.askingRate!)}/${unit}`)
    .join(" · ");
}
