/**
 * Registration validation.
 *
 * Hand-written rather than schema-library-driven: almost every field here is
 * an Indian statutory identifier with a fixed, checkable shape, and getting
 * those formats right is the actual work. Catching a malformed IFSC at the
 * form is worth far more than a generic "required" engine.
 *
 * Server-side re-validation is still mandatory when the route handlers land —
 * these checks are for the person typing, not for the data.
 */

import { isWellFormedAadhaar } from "@/lib/domain/kyc";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/* -------------------------------------------------------------------------
   Field formats
   ------------------------------------------------------------------------- */

/** `33AAECK4521M1ZP` — state code, PAN, entity number, Z, checksum. */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** `AAECK4521M` */
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** `HDFC0001234` — four letters, a zero, then six alphanumerics. */
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Ten digits starting 6–9. Stored without the country code. */
const MOBILE = /^[6-9][0-9]{9}$/;

const PINCODE = /^[1-9][0-9]{5}$/;

const AADHAAR = /^[0-9]{12}$/;

/** FSSAI licence numbers are exactly fourteen digits. */
const FSSAI = /^[0-9]{14}$/;

/** `TN 20 BA 4471`, with or without spaces. */
const VEHICLE_REGISTRATION =
  /^[A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,3}\s?[0-9]{1,4}$/;

/** `TN20 20180004471` — state, RTO, then eleven digits. */
const DRIVING_LICENCE = /^[A-Z]{2}[0-9]{2}\s?[0-9]{11}$/;

const BANK_ACCOUNT = /^[0-9]{9,18}$/;

export function normalise(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

/* -------------------------------------------------------------------------
   Reusable checks
   ------------------------------------------------------------------------- */

export function required(value: string, label: string): string | undefined {
  return value.trim() === "" ? `${label} is required` : undefined;
}

export function checkMobile(value: string): string | undefined {
  if (value.trim() === "") return "Mobile number is required";
  const digits = value.replace(/[\s+]/g, "").replace(/^91/, "");
  return MOBILE.test(digits)
    ? undefined
    : "Enter a 10-digit Indian mobile number starting 6–9";
}

/**
 * A mobile number as Firebase wants it: `+919843011204`.
 *
 * Numbers are stored on the account as ten bare digits, because that is how
 * they are said, written and read back over the phone here. Firebase Auth
 * insists on E.164, so the country code is added at the boundary rather than
 * being carried around in the data — one representation in the database, one
 * conversion where an external system requires a different one.
 *
 * Returns null when the input is not a valid Indian mobile, so a caller cannot
 * accidentally hand Firebase a malformed number and get a confusing error back
 * from it instead of a clear one from here.
 */
export function toE164(value: string): string | null {
  const digits = value.replace(/[^0-9]/g, "").replace(/^0+/, "");
  const ten =
    digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  return MOBILE.test(ten) ? `+91${ten}` : null;
}

export function checkPincode(value: string): string | undefined {
  if (value.trim() === "") return "PIN code is required";
  return PINCODE.test(value.trim()) ? undefined : "Enter a 6-digit PIN code";
}

/**
 * Deliberately loose.
 *
 * Enough to catch a typo — a missing @ or a bare domain — and no more. Every
 * stricter pattern rejects addresses that genuinely work, and an agency turned
 * away at registration because of a regex is an agency that phones instead.
 */
export function checkEmail(
  value: string,
  optional = false,
): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return optional ? undefined : "Email is required";
  // `\s` and `\.`, both of which had lost their backslash. `[^s@]` reads as
  // "not the letter s", so this rejected every address with an s in it —
  // purchasing@, ops@, sales@ — and said "that does not look like an email"
  // about addresses that were fine.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
    ? undefined
    : "That does not look like an email address";
}

export function checkGstin(
  value: string,
  optional = false,
): string | undefined {
  if (value.trim() === "") return optional ? undefined : "GSTIN is required";
  return GSTIN.test(normalise(value).replace(/\s/g, ""))
    ? undefined
    : "Not a valid GSTIN, e.g. 33AAECK4521M1ZP";
}

export function checkPan(value: string, optional = false): string | undefined {
  if (value.trim() === "") return optional ? undefined : "PAN is required";
  return PAN.test(normalise(value).replace(/\s/g, ""))
    ? undefined
    : "Not a valid PAN, e.g. AAECK4521M";
}

export function checkIfsc(value: string): string | undefined {
  if (value.trim() === "") return "IFSC is required";
  return IFSC.test(normalise(value).replace(/\s/g, ""))
    ? undefined
    : "Not a valid IFSC, e.g. HDFC0001234";
}

export function checkBankAccount(value: string): string | undefined {
  if (value.trim() === "") return "Account number is required";
  return BANK_ACCOUNT.test(value.replace(/\s/g, ""))
    ? undefined
    : "Account numbers are 9 to 18 digits";
}

/**
 * The same Aadhaar rule the verification flow uses, rather than a looser one.
 *
 * This checked only that there were twelve digits, while `isWellFormedAadhaar`
 * in `lib/domain/kyc.ts` also runs the Verhoeff checksum an Aadhaar number
 * carries. The two disagreed, and the disagreement was the defect: a driver or
 * worker could be filed with a number these forms accepted and verification
 * then refused, so the record was already wrong by the time anybody looked at
 * it — and the person filing it had been told it was fine.
 *
 * The checksum catches roughly every single-digit error and adjacent
 * transposition. It says a number is *well formed*, never that it belongs to
 * anybody; only UIDAI can say that, and conflating the two is how "Aadhaar
 * verified" comes to mean nothing.
 */
export function checkAadhaar(
  value: string,
  optional = false,
): string | undefined {
  const digits = value.replace(/\s/g, "");
  if (digits.trim() === "") return optional ? undefined : "Aadhaar is required";
  if (!AADHAAR.test(digits)) return "Aadhaar is 12 digits";
  return isWellFormedAadhaar(digits)
    ? undefined
    : "That Aadhaar number is not valid — check the twelve digits, one is mistyped";
}

export function checkFssai(
  value: string,
  optional = false,
): string | undefined {
  if (value.trim() === "")
    return optional ? undefined : "FSSAI licence is required";
  return FSSAI.test(value.replace(/\s/g, ""))
    ? undefined
    : "FSSAI licence numbers are 14 digits";
}

export function checkVehicleRegistration(value: string): string | undefined {
  if (value.trim() === "") return "Registration number is required";
  return VEHICLE_REGISTRATION.test(normalise(value))
    ? undefined
    : "Not a valid registration, e.g. TN 20 BA 4471";
}

export function checkDrivingLicence(value: string): string | undefined {
  if (value.trim() === "") return "Licence number is required";
  return DRIVING_LICENCE.test(normalise(value))
    ? undefined
    : "Not a valid licence number, e.g. TN20 20180004471";
}

/**
 * A document date that must be in the future.
 *
 * Registering something already expired is a data-entry error worth catching
 * at the form — it would otherwise land straight in the admin console's
 * expired queue.
 */
export function checkFutureDate(
  value: string,
  label: string,
  optional = false,
): string | undefined {
  if (value.trim() === "") return optional ? undefined : `${label} is required`;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return `${label} is not a valid date`;
  return parsed <= Date.now() ? `${label} is already in the past` : undefined;
}

export function checkPositiveNumber(
  value: string,
  label: string,
): string | undefined {
  if (value.trim() === "") return `${label} is required`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${label} must be a number`;
  return parsed <= 0 ? `${label} must be greater than zero` : undefined;
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).some(Boolean);
}

/* -------------------------------------------------------------------------
   Form shapes
   ------------------------------------------------------------------------- */

/*
  `BuyerForm` and `validateBuyer` stood here until buyers began registering
  themselves. They belonged to an admin form that wrote nothing — see the note
  on `app/(console)/(admin)/admin/buyers/page.tsx`. Self-signup validates
  through `validateSignup` in `lib/domain/signup.ts`, and the documents a buyer
  has to produce are checked by the KYC flow rather than at registration, which
  is why registration no longer asks for a GSTIN it cannot verify yet.
*/

export interface FarmerForm {
  name: string;
  mobile: string;
  village: string;
  district: string;
  pincode: string;
  landAcres: string;
  primaryCrops: string[];
  aadhaar: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifsc: string;
  onboardedBy: string;
}

export function validateFarmer(values: FarmerForm): FieldErrors<FarmerForm> {
  return {
    name: required(values.name, "Farmer name"),
    mobile: checkMobile(values.mobile),
    village: required(values.village, "Village"),
    district: required(values.district, "District"),
    pincode: checkPincode(values.pincode),
    landAcres: checkPositiveNumber(values.landAcres, "Land under cultivation"),
    primaryCrops:
      values.primaryCrops.length === 0 ? "Select at least one crop" : undefined,
    aadhaar: checkAadhaar(values.aadhaar),
    bankAccountName: required(values.bankAccountName, "Account holder name"),
    bankAccountNumber: checkBankAccount(values.bankAccountNumber),
    ifsc: checkIfsc(values.ifsc),
    // Never blank: a farmer is always onboarded by an account answerable
    // for the record.
    onboardedBy: required(values.onboardedBy, "Onboarding account"),
  };
}

export interface DriverForm {
  name: string;
  mobile: string;
  addressLine: string;
  district: string;
  pincode: string;
  aadhaar: string;
  licenceNumber: string;
  licenceClass: string;
  licenceExpiry: string;
  assignedVehicle: string;
}

export function validateDriver(values: DriverForm): FieldErrors<DriverForm> {
  return {
    name: required(values.name, "Driver name"),
    mobile: checkMobile(values.mobile),
    addressLine: required(values.addressLine, "Address"),
    district: required(values.district, "District"),
    pincode: checkPincode(values.pincode),
    aadhaar: checkAadhaar(values.aadhaar),
    licenceNumber: checkDrivingLicence(values.licenceNumber),
    licenceClass: required(values.licenceClass, "Licence class"),
    licenceExpiry: checkFutureDate(values.licenceExpiry, "Licence expiry"),
  };
}

export interface AgencyForm {
  name: string;
  services: string[];
  contactName: string;
  mobile: string;
  email: string;
  addressLine: string;
  town: string;
  district: string;
  pincode: string;
  serviceDistricts: string[];
  gstin: string;
  pan: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifsc: string;
}

/**
 * An agency is a business, so it is validated like one: GST and PAN, not
 * Aadhaar. The service districts matter as much as the address — an agency is
 * only useful where it will actually send people, and a contract that does not
 * say where is a contract nobody can dispatch against.
 */
export function validateAgency(values: AgencyForm): FieldErrors<AgencyForm> {
  return {
    name: required(values.name, "Agency name"),
    services:
      values.services.length === 0
        ? "Pick at least one — manpower, transport, or both"
        : undefined,
    contactName: required(values.contactName, "Contact name"),
    mobile: checkMobile(values.mobile),
    email: checkEmail(values.email),
    addressLine: required(values.addressLine, "Address"),
    town: required(values.town, "Town"),
    district: required(values.district, "District"),
    pincode: checkPincode(values.pincode),
    serviceDistricts:
      values.serviceDistricts.length === 0
        ? "Pick the districts this agency will serve"
        : undefined,
    gstin: checkGstin(values.gstin),
    pan: checkPan(values.pan),
    bankAccountName: required(values.bankAccountName, "Account holder name"),
    bankAccountNumber: checkBankAccount(values.bankAccountNumber),
    ifsc: checkIfsc(values.ifsc),
  };
}

export interface ManpowerForm {
  name: string;
  mobile: string;
  district: string;
  place: string;
  skills: string[];
  basis: string;
  /** Entered in rupees; converted to paise on submit. */
  rate: string;
  aadhaar: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifsc: string;
}

/**
 * Bank details are required, not optional.
 *
 * A crew member who cannot be paid electronically is a crew member paid in
 * cash at the roadside, which is exactly the arrangement this platform exists
 * to replace.
 */
export function validateManpower(
  values: ManpowerForm,
): FieldErrors<ManpowerForm> {
  const rate = Number(values.rate);

  return {
    name: required(values.name, "Name"),
    mobile: checkMobile(values.mobile),
    district: required(values.district, "District"),
    place: required(values.place, "Village or town"),
    skills:
      values.skills.length === 0
        ? "Pick at least one skill — a crew is assigned by what it can do"
        : undefined,
    basis: required(values.basis, "Engagement basis"),
    rate:
      values.rate.trim() === ""
        ? "Rate — required"
        : !Number.isFinite(rate) || rate <= 0
          ? "Rate must be more than zero"
          : undefined,
    aadhaar: checkAadhaar(values.aadhaar),
    bankAccountName: required(values.bankAccountName, "Account holder name"),
    bankAccountNumber: checkBankAccount(values.bankAccountNumber),
    ifsc: checkIfsc(values.ifsc),
  };
}

export interface VehicleForm {
  registration: string;
  type: string;
  capacityKg: string;
  refrigerated: boolean;
  owner: string;
  district: string;
  rcNumber: string;
  insurer: string;
  insurancePolicy: string;
  insuranceExpiry: string;
  fitnessNumber: string;
  fitnessExpiry: string;
  permitNumber: string;
  permitExpiry: string;
  assignedDriver: string;
}

export function validateVehicle(values: VehicleForm): FieldErrors<VehicleForm> {
  return {
    registration: checkVehicleRegistration(values.registration),
    type: required(values.type, "Vehicle type"),
    capacityKg: checkPositiveNumber(values.capacityKg, "Capacity"),
    owner: required(values.owner, "Owner"),
    district: required(values.district, "Operating district"),
    rcNumber: required(values.rcNumber, "RC number"),
    insurer: required(values.insurer, "Insurer"),
    insurancePolicy: required(values.insurancePolicy, "Policy number"),
    insuranceExpiry: checkFutureDate(
      values.insuranceExpiry,
      "Insurance expiry",
    ),
    fitnessNumber: required(values.fitnessNumber, "Fitness certificate number"),
    fitnessExpiry: checkFutureDate(values.fitnessExpiry, "Fitness expiry"),
    permitNumber: required(values.permitNumber, "Permit number"),
    permitExpiry: checkFutureDate(values.permitExpiry, "Permit expiry"),
  };
}

/**
 * A number plate, written the way it is written on the lorry.
 *
 * Stored canonical — `roster-write` strips the spaces, because "tn 38 aa 1234"
 * and "TN38AA1234" are the same vehicle and a lookup has to agree with itself.
 * Read, that same value is a run of ten characters nobody scans easily, and it
 * sat beside seeded records that *did* carry spaces — so the fleet table
 * showed one field in two formats depending on where the row came from.
 *
 * Grouped here on the way out rather than stored grouped, so the canonical
 * form stays canonical and every screen shows the same thing.
 *
 * Anything that is not a recognisable Indian plate comes back untouched. A
 * registration from a state whose format this does not know is still somebody's
 * lorry, and mangling it would be worse than leaving it alone.
 */
const PLATE_PARTS = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/;

export function formatRegistration(value: string): string {
  const canonical = value.toUpperCase().replace(/\s+/g, "");
  const parts = PLATE_PARTS.exec(canonical);
  if (!parts) return value.trim();

  const [, state, rto, series, number] = parts;
  return `${state} ${rto} ${series} ${number}`;
}
