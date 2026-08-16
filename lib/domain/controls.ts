import "server-only";

import { hasDigits, TOPICS } from "./bargain-vocabulary";
import { isInIndia } from "./distance";
import { POLICY_DOC_ID, POLICY_FIELDS } from "./policy";

/**
 * Reference-data writes.
 *
 * The only collections operations may edit from the Controls page, and the
 * shape each one must satisfy. Deliberately an allowlist rather than a
 * pass-through: an endpoint that will write to any collection you name is a
 * Firestore proxy, not a feature.
 *
 * Every field is copied explicitly. Nothing arrives from the request body and
 * lands in Firestore unread — that is how a client ends up able to set
 * `status: "verified"` on its own record.
 */

export const EDITABLE = [
  "produce",
  "states",
  "districts",
  "places",
  "packs",
  "phrases",
  "bargainPhrases",
  "documentRules",
  "settings",
] as const;

export type EditableCollection = (typeof EDITABLE)[number];

export function isEditable(value: string): value is EditableCollection {
  return (EDITABLE as readonly string[]).includes(value);
}

/**
 * Collections a delete may not touch.
 *
 * `settings` holds exactly one document, and everything on the platform reads
 * it. Deleting it would not error anywhere — every field falls back to a
 * default — which is precisely why it must be impossible: the platform would
 * quietly revert to shipped values and nobody would be told.
 */
const UNDELETABLE: readonly string[] = ["settings"];

export function isDeletable(collection: EditableCollection): boolean {
  return !UNDELETABLE.includes(collection);
}

/** The six languages anything farmer-facing must be writable in. */
const LOCALES = ["en", "ta", "te", "kn", "ml", "hi"] as const;

/** Keeps only known languages, dropping blanks. Shared by names and phrases. */
function cleanLocaleMap(value: unknown): Record<string, string> {
  const source = (value ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    const text = str(source[locale]);
    if (text) out[locale] = text;
  }
  return out;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly data?: Record<string, unknown>;
  /** Document id for a create. Ignored on update. */
  readonly id?: string;
}

function fail(...errors: string[]): ValidationResult {
  return { ok: false, errors };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `Green chilli` → `green-chilli`. Stable, readable document ids. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * A crop icon may be an uploaded image held as a data URI.
 *
 * Capped hard. Icons are compressed to 128px WebP in the browser and land
 * around 3–6 KB; anything approaching this limit is a photograph that has
 * been sent to the wrong field, and Firestore documents cap at 1 MiB.
 */
const MAX_ICON_BYTES = 64 * 1024;

function validIcon(value: unknown): string | null | "invalid" {
  const icon = str(value);
  if (!icon) return null;
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(icon)) return "invalid";
  if (icon.length > MAX_ICON_BYTES) return "invalid";
  return icon;
}

/* -------------------------------------------------------------------------
   Per-collection shapes
   ------------------------------------------------------------------------- */

function validateProduce(body: Record<string, unknown>): ValidationResult {
  const names = (body.names ?? {}) as Record<string, unknown>;
  const en = str(names.en);
  if (!en) return fail("An English name is required.");

  const emoji = str(body.emoji);
  const icon = validIcon(body.iconUrl);
  if (icon === "invalid") {
    return fail("Icon must be a PNG, JPEG or WebP data URI under 64 KB.");
  }
  if (!emoji && !icon) {
    return fail("Choose an emoji or upload an icon.");
  }

  const unit = str(body.defaultUnit);
  if (!["kg", "quintal", "tonne", "crate", "bag"].includes(unit)) {
    return fail("Pick a valid default unit.");
  }

  // Only the six known languages are stored. A stray key would become a
  // column nobody can see and nobody can remove.
  const cleanNames = cleanLocaleMap(names);

  const regional = (body.regional ?? {}) as Record<string, unknown>;
  const cleanRegional: Record<string, Record<string, string>> = {};
  for (const [district, byLocale] of Object.entries(regional)) {
    const entries = cleanLocaleMap(byLocale);
    if (Object.keys(entries).length > 0) cleanRegional[district] = entries;
  }

  // Grading standards, per grade, per language. Same fallback shape as names.
  const grading = (body.grading ?? {}) as Record<string, unknown>;
  const cleanGrading: Record<string, Record<string, string>> = {};
  for (const grade of ["a", "b", "c"]) {
    const entries = cleanLocaleMap(grading[grade]);
    if (Object.keys(entries).length > 0) cleanGrading[grade] = entries;
  }

  let shelfLifeHours: number | null = null;
  if (body.shelfLifeHours !== null && body.shelfLifeHours !== undefined && body.shelfLifeHours !== "") {
    const hours = num(body.shelfLifeHours);
    if (hours === null || hours <= 0) {
      return fail("Shelf life must be a number of hours above zero, or left blank.");
    }
    // A year. Anything longer is a data-entry slip, and shelf life feeds the
    // reefer rule — an absurd value there puts perishable stock on a flatbed.
    if (hours > 8760) {
      return fail("Shelf life over a year is almost certainly a typo. Check the figure.");
    }
    shelfLifeHours = Math.round(hours);
  }

  return {
    ok: true,
    errors: [],
    id: str(body.id) || slugify(en),
    data: {
      names: cleanNames,
      regional: cleanRegional,
      grading: cleanGrading,
      emoji,
      iconUrl: icon,
      defaultUnit: unit,
      shelfLifeHours,
      active: bool(body.active),
    },
  };
}

function validateState(body: Record<string, unknown>): ValidationResult {
  const name = str(body.name);
  if (!name) return fail("State name is required.");

  const prefix = str(body.vehiclePrefix).toUpperCase();
  if (!/^[A-Z]{2}$/.test(prefix)) {
    return fail("Vehicle prefix is two letters, e.g. TN.");
  }

  return {
    ok: true,
    errors: [],
    // The vehicle prefix *is* the state code — `tn`, `ka`, `kl` — and it is
    // already unique across India, already validated above, and already the
    // id convention the seeded data uses. Slugifying the name instead would
    // give `tamil-nadu`, which then breaks the `<state>-<place>` ids derived
    // from it further down.
    id: str(body.id) || prefix.toLowerCase(),
    data: {
      name,
      nativeName: str(body.nativeName) || name,
      locale: str(body.locale) || "en",
      vehiclePrefix: prefix,
      active: bool(body.active),
    },
  };
}

function validateDistrict(body: Record<string, unknown>): ValidationResult {
  const name = str(body.name);
  const stateId = str(body.stateId);
  if (!name) return fail("District name is required.");
  if (!stateId) return fail("A district must belong to a state.");

  // Blank means "use the platform default", which is not the same as zero —
  // zero would let a single crate trigger a vehicle run.
  let minOrderValue: number | null = null;
  if (body.minOrderValue !== null && body.minOrderValue !== undefined && body.minOrderValue !== "") {
    const value = num(body.minOrderValue);
    if (value === null || value < 0) {
      return fail("Minimum order must be zero or more, or left blank for the default.");
    }
    minOrderValue = Math.round(value);
  }

  return {
    ok: true,
    errors: [],
    id: str(body.id) || `${stateId}-${slugify(name)}`,
    data: {
      stateId,
      name,
      nativeName: str(body.nativeName) || null,
      minOrderValue,
      active: bool(body.active),
    },
  };
}

function validatePlace(body: Record<string, unknown>): ValidationResult {
  const name = str(body.name);
  const districtId = str(body.districtId);
  if (!name) return fail("Village or town name is required.");
  if (!districtId) return fail("A place must belong to a district.");

  const pincode = str(body.pincode);
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return fail("PIN code must be six digits and not start with zero.");
  }

  // Coordinates, not a distance. A village stores where it is; how far it is
  // depends on which buyer is asking, so it is computed per pair.
  let lat: number | null = null;
  let lng: number | null = null;
  const hasLat = body.lat !== null && body.lat !== undefined && body.lat !== "";
  const hasLng = body.lng !== null && body.lng !== undefined && body.lng !== "";

  if (hasLat !== hasLng) {
    return fail("A location needs both latitude and longitude, or neither.");
  }

  if (hasLat && hasLng) {
    const parsedLat = num(body.lat);
    const parsedLng = num(body.lng);
    if (parsedLat === null || parsedLng === null) {
      return fail("Latitude and longitude must be numbers.");
    }
    if (Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
      return fail("Latitude must be within ±90 and longitude within ±180.");
    }
    if (!isInIndia({ lat: parsedLat, lng: parsedLng })) {
      // The failure that actually happens is a transposed pair, which for
      // Tamil Nadu lands the pin off Somalia and yields a confident
      // four-thousand-kilometre freight estimate.
      return fail(
        "That pin is outside India — check latitude and longitude are not swapped.",
      );
    }
    lat = parsedLat;
    lng = parsedLng;
  }

  const farmerCount = num(body.farmerCount);
  if (farmerCount === null || farmerCount < 0) {
    return fail("Farmer count must be zero or more.");
  }

  // District ids are `<state>-<district>`, so the leading segment is the state
  // code. Villages are named per state, not per district: two districts in the
  // same state rarely share a village name, but two states routinely do.
  const stateId = districtId.split("-")[0];

  return {
    ok: true,
    errors: [],
    // Prefixed with the state so two districts can hold a village of the same
    // name without colliding — which they genuinely do.
    id: str(body.id) || `${stateId}-${slugify(name)}`,
    data: {
      districtId,
      name,
      nativeName: str(body.nativeName) || null,
      pincode,
      lat,
      lng,
      farmerCount: Math.round(farmerCount),
      active: bool(body.active),
    },
  };
}

/**
 * A pack a crop is traded in — "25 kg crate", "50 kg bag".
 *
 * Money on a stock line is priced *per pack*, so a wrong pack size misprices
 * every line that uses it. That is why the size is a number here and the label
 * is generated from it rather than typed: a label reading "25 kg crate" over a
 * `packSize` of 20 is a lie the buyer has no way to catch.
 */
function validatePack(body: Record<string, unknown>): ValidationResult {
  const unit = str(body.unit);
  if (!["kg", "quintal", "tonne", "crate", "bag"].includes(unit)) {
    return fail("Pick a valid unit.");
  }

  const container = str(body.container);
  if (!container) return fail("Name the container — crate, bag, box, bundle.");

  const packSize = num(body.packSize);
  if (packSize === null || packSize <= 0) {
    return fail("Pack size must be above zero.");
  }

  const label = `${packSize} ${unit} ${container.toLowerCase()}`;

  return {
    ok: true,
    errors: [],
    id: str(body.id) || slugify(label),
    data: {
      unit,
      container,
      packSize,
      // Derived, never accepted from the client. See the note above.
      label,
      active: bool(body.active),
    },
  };
}

/**
 * Something the platform says to a farmer, in every language it speaks.
 *
 * Two kinds share this collection because they share the hard part — being
 * translated six ways and edited without a deploy. A `notification` is sent;
 * a `quickReply` is offered as a tap in the bargaining screen so a farmer with
 * a feature phone does not have to type.
 */
function validatePhrase(body: Record<string, unknown>): ValidationResult {
  const kind = str(body.kind);
  if (!["notification", "quickReply"].includes(kind)) {
    return fail("A phrase is either a notification or a quick reply.");
  }

  const text = cleanLocaleMap(body.text);
  if (!text.en) {
    return fail("English is required — every other language falls back to it.");
  }

  const event = str(body.event);
  if (kind === "notification" && !event) {
    return fail("A notification needs the event that triggers it.");
  }

  const channel = str(body.channel) || "sms";
  if (!["sms", "whatsapp", "inApp"].includes(channel)) {
    return fail("Channel must be SMS, WhatsApp or in-app.");
  }

  // Who the phrase is spoken by decides where it appears. A quick reply the
  // buyer never sees still has to be authored somewhere.
  const audience = str(body.audience) || "farmer";
  if (!["farmer", "buyer", "driver"].includes(audience)) {
    return fail("Audience must be the farmer, the buyer or the driver.");
  }

  return {
    ok: true,
    errors: [],
    id: str(body.id) || slugify(event || text.en),
    data: {
      kind,
      event: event || null,
      channel: kind === "notification" ? channel : null,
      audience,
      text,
      active: bool(body.active),
    },
  };
}

/**
 * A sentence either side of a bargain may send.
 *
 * The strictest validation in this file, and the one worth reading. A bargain
 * has no text box — every message is one of these, chosen by id — so this form
 * is the *only* way words reach a bargaining screen. Two rules follow from
 * that:
 *
 *  - **Every language, or the reader gets English.** Unlike a notification,
 *    which is at least sent to somebody who may have chosen English, a bargain
 *    phrase is read by a farmer who often has not. A missing translation is
 *    allowed but warned about in the UI; only English is refused outright,
 *    because everything falls back to it.
 *
 *  - **No digits, in any script.** A phrase carrying a number is a phrase
 *    carrying a phone number, and the platform would be translating it into
 *    six languages and putting its own authority behind it. This is the rule
 *    the whole fixed-vocabulary design exists to enforce, so it is enforced
 *    where phrases are written, not only in the constant that ships.
 */
function validateBargainPhrase(body: Record<string, unknown>): ValidationResult {
  const text = cleanLocaleMap(body.text);
  if (!text.en) {
    return fail("English is required — every other language falls back to it.");
  }

  for (const [locale, value] of Object.entries(text)) {
    if (hasDigits(value)) {
      return fail(
        `The ${locale.toUpperCase()} text contains a number. Bargain phrases carry no digits — a number here is how a phone number reaches the other side.`,
      );
    }
  }

  const speaker = str(body.speaker) || "both";
  if (!["farmer", "buyer", "both"].includes(speaker)) {
    return fail("Say who may send it: the farmer, the buyer, or either.");
  }

  const topic = str(body.topic) || "closing";
  if (!(TOPICS as readonly string[]).includes(topic)) {
    return fail(`Topic must be one of: ${TOPICS.join(", ")}.`);
  }

  return {
    ok: true,
    errors: [],
    // Slugged from the English, like every other phrase. The id ends up in
    // every message that uses it, so it wants to be readable in a thread read
    // back as a commercial record.
    id: str(body.id) || slugify(text.en),
    data: { text, speaker, topic, active: bool(body.active) },
  };
}

const DOCUMENT_KINDS = [
  "aadhaar",
  "pan",
  "gst",
  "bankProof",
  "drivingLicence",
  "rc",
  "insurance",
  "fitness",
  "permit",
  "fssai",
];

const SUBJECTS = ["farmer", "buyer", "driver", "vehicle"];

/**
 * Which documents a given kind of account must produce in a given state.
 *
 * Per state because compliance is: FSSAI thresholds, APMC licensing and permit
 * rules differ the moment you cross a border. Holding this as a constant works
 * exactly as long as the platform operates in one state.
 */
function validateDocumentRule(body: Record<string, unknown>): ValidationResult {
  const stateId = str(body.stateId);
  if (!stateId) return fail("A document rule belongs to a state.");

  const subject = str(body.subject);
  if (!SUBJECTS.includes(subject)) {
    return fail("Subject must be a farmer, buyer, driver or vehicle.");
  }

  const source = Array.isArray(body.required) ? body.required : [];
  const required = source
    .map((k) => str(k))
    .filter((k) => DOCUMENT_KINDS.includes(k));

  const unknown = source.map((k) => str(k)).filter((k) => k && !DOCUMENT_KINDS.includes(k));
  if (unknown.length > 0) {
    // Silently dropping an unknown document kind would show a rule that reads
    // as saved while quietly requiring less than the operator asked for.
    return fail(`Unknown document: ${unknown.join(", ")}.`);
  }

  return {
    ok: true,
    errors: [],
    id: str(body.id) || `${stateId}-${subject}`,
    data: {
      stateId,
      subject,
      required,
      active: bool(body.active),
    },
  };
}

/**
 * The policy singleton.
 *
 * Validated field by field against its declared bounds, plus the one relation
 * that cannot be expressed as a bound: the "use soon" band has to sit above
 * "today only", or the middle band is unreachable and stock jumps from fresh
 * to end-of-life with no warning.
 */
function validateSettings(body: Record<string, unknown>): ValidationResult {
  const data: Record<string, number> = {};

  for (const field of POLICY_FIELDS) {
    const raw = body[field.key];
    const value = num(raw);
    if (value === null) {
      return fail(`${field.label} must be a number.`);
    }
    if (value < field.min || value > field.max) {
      return fail(
        `${field.label} must be between ${field.min} and ${field.max} ${field.suffix}.`,
      );
    }
    data[field.key] = Math.round(value);
  }

  if (data.useSoonHours <= data.endOfLifeHours) {
    return fail(
      "The use-soon band must sit above today-only, otherwise stock goes from fresh straight to end-of-life with no warning in between.",
    );
  }

  return { ok: true, errors: [], id: POLICY_DOC_ID, data };
}

export function validate(
  collection: EditableCollection,
  body: Record<string, unknown>,
): ValidationResult {
  switch (collection) {
    case "produce":
      return validateProduce(body);
    case "states":
      return validateState(body);
    case "districts":
      return validateDistrict(body);
    case "places":
      return validatePlace(body);
    case "packs":
      return validatePack(body);
    case "phrases":
      return validatePhrase(body);
    case "bargainPhrases":
      return validateBargainPhrase(body);
    case "documentRules":
      return validateDocumentRule(body);
    case "settings":
      return validateSettings(body);
  }
}

/**
 * What a delete would orphan.
 *
 * Reference data is referenced — that is the point of it. Deleting a district
 * with villages under it leaves those villages unreachable, and deleting a
 * crop that listings point at leaves those listings nameless. The API refuses
 * and says what is in the way rather than cascading, because a cascade here
 * would quietly destroy trade records.
 */
export const DEPENDENTS: Record<
  EditableCollection,
  ReadonlyArray<{ collection: string; field: string; label: string }>
> = {
  states: [
    { collection: "districts", field: "stateId", label: "district" },
    { collection: "documentRules", field: "stateId", label: "document rule" },
  ],
  districts: [{ collection: "places", field: "districtId", label: "place" }],
  places: [{ collection: "stock", field: "placeId", label: "stock line" }],
  produce: [
    { collection: "listings", field: "produceId", label: "listing" },
    { collection: "stock", field: "produceId", label: "stock line" },
  ],
  packs: [{ collection: "stock", field: "packId", label: "stock line" }],
  // Nothing references a phrase or a rule by id — they are looked up by event
  // and by state. Deleting one is a content decision, not a structural one.
  phrases: [],
  // Messages do reference a bargain phrase by id, but they also store the
  // English text alongside it, so a thread stays readable after its phrase is
  // deleted. Blocking the delete on "used by 400 messages" would mean the
  // vocabulary could never be tidied.
  bargainPhrases: [],
  documentRules: [],
  settings: [],
};
