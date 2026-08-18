import type { Role } from "@/lib/auth/claims";
import type { DocumentKind } from "@/lib/domain/admin";
import { maskAadhaar } from "@/lib/domain/kyc";
import {
  validateDriver,
  validateManpower,
  validateVehicle,
  type DriverForm,
  type ManpowerForm,
  type VehicleForm,
} from "@/lib/domain/registration";

/**
 * The records an agency keeps: its lorries, its drivers, its crew.
 *
 * These are not accounts. A lorry does not sign in, and a loader is not a
 * tenant — so unlike a buyer or an agency, there is no self-registration path
 * for them and never will be. The agency's own console is the right place to
 * enter one, which is where the three forms already lived. What they did not do
 * was write anything: each waited half a second, said "registered", and pushed
 * back to a list the record had never reached.
 *
 * This is the shaping half of the fix. It is deliberately pure — the route
 * decides who is asking, and this decides what a valid answer turns into — so
 * that the rule which matters most can be tested without a database:
 *
 * **The agency id is never taken from the caller.** It is passed in from the
 * session by the route. A body-supplied `agencyId` would let any signed-in
 * agency file a lorry under a competitor, or read one back.
 */

export const ROSTER_KINDS = ["vehicles", "drivers", "workers"] as const;

export type RosterKind = (typeof ROSTER_KINDS)[number];

export function isRosterKind(value: string): value is RosterKind {
  return (ROSTER_KINDS as readonly string[]).includes(value);
}

export interface RosterDefinition {
  readonly collection: string;
  /** Which service may file this kind of record. */
  readonly role: Role;
  readonly one: string;
  /** Prefix for generated ids, so a document id says what it is. */
  readonly prefix: string;
}

/*
  Transport keeps vehicles and drivers; manpower keeps workers. The two share a
  collection of agencies and share nothing here — a labour contractor filing a
  lorry is a mistake, not a feature, and the role on the session is the only
  thing that can tell the two apart.
*/
export const ROSTER: Record<RosterKind, RosterDefinition> = {
  vehicles: {
    collection: "vehicles",
    role: "transport",
    one: "Vehicle",
    prefix: "V",
  },
  drivers: {
    collection: "drivers",
    role: "transport",
    one: "Driver",
    prefix: "D",
  },
  workers: {
    collection: "workers",
    role: "manpower",
    one: "Worker",
    prefix: "W",
  },
};

/** One uploaded file, as it comes back from the signed-URL exchange. */
export interface Attachment {
  readonly path: string;
  readonly contentType: string;
}

/** Which attachments each kind expects, and which document each belongs to. */
export const ATTACHMENTS: Record<
  RosterKind,
  Record<string, DocumentKind | "photo" | "plate">
> = {
  vehicles: {
    vehiclePhoto: "photo",
    numberPlate: "plate",
    rc: "rc",
    insurance: "insurance",
    fitness: "fitness",
    permit: "permit",
  },
  drivers: {
    portrait: "photo",
    licenceFront: "drivingLicence",
    licenceBack: "drivingLicence",
    aadhaar: "aadhaar",
  },
  workers: {
    portrait: "photo",
    aadhaar: "aadhaar",
    bankProof: "bankProof",
  },
};

export interface RosterSubmission {
  readonly kind: RosterKind;
  readonly values: Record<string, unknown>;
  /** Storage paths, keyed by the slot they were uploaded for. */
  readonly files: Record<string, Attachment | undefined>;
}

export class RosterError extends Error {
  constructor(
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "RosterError";
  }
}

function str(value: unknown, max = 120): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * The fields this kind expects, every one of them a string.
 *
 * The shared validators call `.trim()` on what they are given, so a body that
 * simply omits a field used to throw `Cannot read properties of undefined`
 * before any validation ran — the caller got a 422 with a stack-shaped message
 * and no idea which field was wrong. Filling the shape first means a missing
 * field is an *empty* field, which is a case every validator already answers
 * properly.
 */
const FIELDS: Record<RosterKind, readonly string[]> = {
  vehicles: [
    "registration",
    "type",
    "capacityKg",
    "owner",
    "district",
    "rcNumber",
    "insurer",
    "insurancePolicy",
    "insuranceExpiry",
    "fitnessNumber",
    "fitnessExpiry",
    "permitNumber",
    "permitExpiry",
    "assignedDriver",
  ],
  drivers: [
    "name",
    "mobile",
    "addressLine",
    "district",
    "pincode",
    "aadhaar",
    "licenceNumber",
    "licenceClass",
    "licenceExpiry",
    "assignedVehicle",
  ],
  workers: [
    "name",
    "mobile",
    "district",
    "place",
    "basis",
    "rate",
    "aadhaar",
    "bankAccountName",
    "bankAccountNumber",
    "ifsc",
  ],
};

function formOf(
  kind: RosterKind,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const form: Record<string, unknown> = {};
  for (const field of FIELDS[kind]) form[field] = str(values[field], 200);

  if (kind === "vehicles") form.refrigerated = values.refrigerated === true;
  if (kind === "workers") {
    form.skills = Array.isArray(values.skills)
      ? values.skills.map((skill) => str(skill, 40)).filter(Boolean)
      : [];
  }

  return form;
}

/** A date at the end of the given day, or undefined for a blank. */
function expiry(value: string): Date | undefined {
  if (!value) return undefined;
  const at = new Date(`${value}T23:59:59`);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

function attach(
  kind: RosterKind,
  files: Record<string, Attachment | undefined>,
  document: DocumentKind,
): Attachment[] {
  return Object.entries(ATTACHMENTS[kind])
    .filter(([, belongsTo]) => belongsTo === document)
    .map(([slot]) => files[slot])
    .filter((file): file is Attachment => Boolean(file));
}

function photo(
  kind: RosterKind,
  files: Record<string, Attachment | undefined>,
  which: "photo" | "plate",
) {
  const slot = Object.entries(ATTACHMENTS[kind]).find(
    ([, belongsTo]) => belongsTo === which,
  );
  return slot ? files[slot[0]]?.path : undefined;
}

/**
 * A validated submission as the document that will be written.
 *
 * Status is always `pending`, and is not taken from the submission. A vehicle
 * that could file itself as verified is a vehicle that can be dispatched
 * without anybody having looked at its permit.
 */
export function buildRosterRecord(
  submission: RosterSubmission,
  agencyId: string,
  now: Date,
): Record<string, unknown> {
  const { kind, files } = submission;
  if (!agencyId) throw new RosterError("This session has no agency.");

  const values = formOf(kind, submission.values);

  const common = {
    agencyId,
    status: "pending" as const,
    registeredAt: now,
    photoUrl: photo(kind, files, "photo") ?? null,
  };

  if (kind === "vehicles") {
    const form = values as unknown as VehicleForm;
    reject(validateVehicle(form));

    return {
      ...common,
      // Upper-cased once here rather than at every read: a registration is a
      // plate, and "tn 38 aa 1234" and "TN38AA1234" are the same lorry.
      registration: str(form.registration).toUpperCase().replace(/\s+/g, ""),
      type: str(form.type, 20),
      capacityKg: Number(form.capacityKg) || 0,
      refrigerated: form.refrigerated === true,
      owner: str(form.owner),
      district: str(form.district),
      platePhotoUrl: photo(kind, files, "plate") ?? null,
      assignedDriver: str(form.assignedDriver) || null,
      documents: [
        document("rc", form.rcNumber, undefined, attach(kind, files, "rc")),
        document(
          "insurance",
          `${str(form.insurer)} · ${str(form.insurancePolicy)}`,
          expiry(form.insuranceExpiry),
          attach(kind, files, "insurance"),
        ),
        document(
          "fitness",
          form.fitnessNumber,
          expiry(form.fitnessExpiry),
          attach(kind, files, "fitness"),
        ),
        document(
          "permit",
          form.permitNumber,
          expiry(form.permitExpiry),
          attach(kind, files, "permit"),
        ),
      ],
    };
  }

  if (kind === "drivers") {
    const form = values as unknown as DriverForm;
    reject(validateDriver(form));

    return {
      ...common,
      name: str(form.name),
      mobile: str(form.mobile, 20),
      district: str(form.district),
      addressLine: str(form.addressLine, 200),
      pincode: str(form.pincode, 10),
      tripsCompleted: 0,
      assignedVehicle: str(form.assignedVehicle) || null,
      documents: [
        document(
          "drivingLicence",
          `${str(form.licenceNumber)} · ${str(form.licenceClass, 20)}`,
          expiry(form.licenceExpiry),
          attach(kind, files, "drivingLicence"),
        ),
        // Masked before it is shaped, never after. `maskAadhaar` is the only
        // path a number takes into storage on this platform.
        document(
          "aadhaar",
          masked(form.aadhaar),
          undefined,
          attach(kind, files, "aadhaar"),
        ),
      ],
    };
  }

  const form = values as unknown as ManpowerForm;
  reject(validateManpower(form));

  return {
    ...common,
    name: str(form.name),
    mobile: str(form.mobile, 20),
    district: str(form.district),
    place: str(form.place),
    skills: Array.isArray(form.skills)
      ? form.skills.map((s) => str(s, 40)).filter(Boolean)
      : [],
    basis: str(form.basis, 20),
    // Entered in rupees, held in paise, like every other amount here.
    rate: Math.round(Number(form.rate) * 100) || 0,
    documents: [
      document(
        "aadhaar",
        masked(form.aadhaar),
        undefined,
        attach(kind, files, "aadhaar"),
      ),
      document(
        "bankProof",
        `${str(form.bankAccountName)} · ${str(form.bankAccountNumber, 40)} · ${str(form.ifsc, 20).toUpperCase()}`,
        undefined,
        attach(kind, files, "bankProof"),
      ),
    ],
  };
}

function document(
  kind: DocumentKind,
  reference: string,
  expiresAt: Date | undefined,
  files: Attachment[],
) {
  return {
    kind,
    reference: str(reference, 200),
    // Absent rather than null for a document that does not lapse — the reader
    // treats a missing date as "does not expire", and a null as expired.
    ...(expiresAt ? { expiresAt } : {}),
    files,
  };
}

/**
 * Masking, with the refusal attached to the field it belongs to.
 *
 * `maskAadhaar` throws a message worth reading, but thrown bare it reaches the
 * form as a banner rather than a mark against the Aadhaar box — which is the
 * one place the person is going to look.
 */
function masked(aadhaar: unknown): string {
  try {
    return maskAadhaar(str(aadhaar, 20));
  } catch (error) {
    throw new RosterError("Check the highlighted fields.", {
      aadhaar: error instanceof Error ? error.message : "Check this number",
    });
  }
}

/** Turns the shared field validators into one refusal the route can return. */
function reject(errors: Record<string, string | undefined>): void {
  const failed = Object.entries(errors).filter(([, message]) => message);
  if (failed.length > 0) {
    throw new RosterError(
      "Check the highlighted fields.",
      Object.fromEntries(failed) as Record<string, string>,
    );
  }
}
