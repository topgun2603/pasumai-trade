import { describe, expect, it } from "vitest";

import { buildRosterRecord, isRosterKind, ROSTER, RosterError } from "./roster-write";

const NOW = new Date("2026-08-19T09:00:00Z");

const VEHICLE = {
  registration: "tn 38 zz 4321",
  type: "truck",
  capacityKg: "9000",
  refrigerated: false,
  owner: "Kongu Transport",
  district: "Erode",
  rcNumber: "RC-1",
  insurer: "United India",
  insurancePolicy: "POL-9",
  insuranceExpiry: "2027-01-31",
  fitnessNumber: "FIT-9",
  fitnessExpiry: "2027-02-28",
  permitNumber: "PER-9",
  permitExpiry: "2027-03-31",
  assignedDriver: "",
};

const DRIVER = {
  name: "Murugan S",
  mobile: "9876500022",
  addressLine: "1 Main Street",
  district: "Erode",
  pincode: "638001",
  aadhaar: "499118665246",
  licenceNumber: "TN3820180001234",
  licenceClass: "HMV",
  licenceExpiry: "2028-06-30",
  assignedVehicle: "",
};

const WORKER = {
  name: "Selvi R",
  mobile: "9876500033",
  district: "Erode",
  place: "Perundurai",
  skills: ["loading"],
  basis: "perTrip",
  rate: "450",
  aadhaar: "499118665246",
  bankAccountName: "Selvi R",
  bankAccountNumber: "123456789012",
  ifsc: "hdfc0001234",
};

function build(kind: "vehicles" | "drivers" | "workers", values: object, files = {}) {
  return buildRosterRecord({ kind, values: values as Record<string, unknown>, files }, "AG-105", NOW);
}

describe("filing an agency's own records", () => {
  it("stamps the agency from the session, never from the submission", () => {
    // The single rule worth a test of its own: a body claiming another agency
    // must not be able to file under it, or read it back afterwards.
    const record = build("vehicles", { ...VEHICLE, agencyId: "AG-SOMEONE-ELSE" });
    expect(record.agencyId).toBe("AG-105");
  });

  it("refuses to file anything without an agency", () => {
    expect(() =>
      buildRosterRecord({ kind: "vehicles", values: VEHICLE, files: {} }, "", NOW),
    ).toThrow(RosterError);
  });

  it("always starts pending, whatever the submission says", () => {
    // A vehicle that could file itself verified is a vehicle dispatched without
    // anybody having read its permit.
    const record = build("vehicles", { ...VEHICLE, status: "verified" });
    expect(record.status).toBe("pending");
  });

  it("normalises a registration, because a plate is a plate", () => {
    expect(build("vehicles", VEHICLE).registration).toBe("TN38ZZ4321");
  });

  it("names every missing field rather than throwing on the first", () => {
    // Empty values used to reach `.trim()` on undefined and come back as a
    // stack-shaped message with nothing the form could mark.
    try {
      build("vehicles", {});
      expect.unreachable("should have refused");
    } catch (error) {
      expect(error).toBeInstanceOf(RosterError);
      const fields = (error as RosterError).fields ?? {};
      expect(Object.keys(fields)).toEqual(
        expect.arrayContaining(["registration", "type", "owner", "district", "rcNumber"]),
      );
    }
  });

  it("keeps only the last four digits of an Aadhaar", () => {
    for (const kind of ["drivers", "workers"] as const) {
      const record = build(kind, kind === "drivers" ? DRIVER : WORKER);
      const documents = record.documents as Array<{ kind: string; reference: string }>;
      const aadhaar = documents.find((d) => d.kind === "aadhaar")!;

      expect(aadhaar.reference).toBe("XXXX XXXX 5246");
      // The full number must not survive anywhere in the record.
      expect(JSON.stringify(record)).not.toContain("499118665246");
    }
  });

  it("marks a malformed Aadhaar against its own field", () => {
    try {
      build("drivers", { ...DRIVER, aadhaar: "12345" });
      expect.unreachable("should have refused");
    } catch (error) {
      expect((error as RosterError).fields?.aadhaar).toBeTruthy();
    }
  });

  it("holds a crew rate in paise, like every other amount", () => {
    expect(build("workers", WORKER).rate).toBe(45_000);
  });

  it("omits the expiry of a document that does not lapse", () => {
    const documents = build("workers", WORKER).documents as Array<Record<string, unknown>>;
    const aadhaar = documents.find((d) => d.kind === "aadhaar")!;
    // Absent, not null: the reader treats a missing date as "does not expire"
    // and a null as expired.
    expect("expiresAt" in aadhaar).toBe(false);
    expect(documents.find((d) => d.kind === "bankProof")).toBeTruthy();
  });

  it("attaches each uploaded file to the document it was taken for", () => {
    const record = build(
      "vehicles",
      VEHICLE,
      {
        vehiclePhoto: { path: "roster/AG-105/vehicles/vehiclePhoto/a.jpg", contentType: "image/jpeg" },
        numberPlate: { path: "roster/AG-105/vehicles/numberPlate/b.jpg", contentType: "image/jpeg" },
        permit: { path: "roster/AG-105/vehicles/permit/c.pdf", contentType: "application/pdf" },
      },
    );

    expect(record.photoUrl).toBe("roster/AG-105/vehicles/vehiclePhoto/a.jpg");
    expect(record.platePhotoUrl).toBe("roster/AG-105/vehicles/numberPlate/b.jpg");

    const documents = record.documents as Array<{ kind: string; files: unknown[] }>;
    expect(documents.find((d) => d.kind === "permit")!.files).toHaveLength(1);
    // A document nobody uploaded for carries no files rather than a stray one.
    expect(documents.find((d) => d.kind === "rc")!.files).toHaveLength(0);
  });

  it("puts both sides of a licence on the one document", () => {
    const record = build("drivers", DRIVER, {
      licenceFront: { path: "roster/AG-105/drivers/licenceFront/a.jpg", contentType: "image/jpeg" },
      licenceBack: { path: "roster/AG-105/drivers/licenceBack/b.jpg", contentType: "image/jpeg" },
    });

    const documents = record.documents as Array<{ kind: string; files: unknown[] }>;
    expect(documents.find((d) => d.kind === "drivingLicence")!.files).toHaveLength(2);
  });

  it("lets only the right service file each kind", () => {
    expect(ROSTER.vehicles.role).toBe("transport");
    expect(ROSTER.drivers.role).toBe("transport");
    expect(ROSTER.workers.role).toBe("manpower");
  });

  it("recognises its own kinds and nothing else", () => {
    expect(isRosterKind("vehicles")).toBe(true);
    expect(isRosterKind("lorries")).toBe(false);
    expect(isRosterKind("agencies")).toBe(false);
  });
});
