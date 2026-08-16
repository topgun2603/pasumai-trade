import { describe, expect, it } from "vitest";

import type { Agency } from "./admin";
import { availableAgencies, canRequest, requestDispatch } from "./dispatch-request";
import type { Negotiation } from "./negotiation";

const NOW = new Date("2026-08-16T09:00:00+05:30");
const CLOCK = NOW.getTime();
const YEAR = 365 * 86_400_000;

function agency(over: Partial<Agency> = {}): Agency {
  return {
    id: "AG-105",
    name: "Kongu Transport",
    services: ["transport"],
    contactName: "R. Jayaraman",
    mobile: "9047571166",
    email: "j@kongutm.in",
    district: "Erode",
    town: "Bhavani",
    districts: ["Erode", "Tiruppur"],
    status: "verified",
    registeredAt: NOW,
    documents: [
      { kind: "gst", reference: "33AAECK4521M1ZP", expiresAt: new Date(CLOCK + YEAR) },
    ],
    ...over,
  } as Agency;
}

function settled(over: Partial<Negotiation> = {}): Negotiation {
  return {
    id: "N-1",
    listingId: "L-1",
    produceName: "Tomato",
    farmerId: "F-201",
    buyerId: "B-1001",
    farmerName: "R. Murugan",
    buyerName: "Kongu Agri",
    quantity: 800,
    unit: "kg",
    status: "agreed",
    messages: [],
    openedAt: NOW,
    agreedAt: NOW,
    agreedBands: [{ grade: "a", ratePerUnit: 2600 }],
    ...over,
  };
}

const base = { pickupDistrict: "Erode", now: CLOCK };

describe("arranging transport", () => {
  it("allows it on a settled bargain", () => {
    expect(canRequest({ negotiation: settled(), agency: agency(), ...base })).toEqual({ ok: true });
  });

  it("refuses before a price is agreed", () => {
    // The mistake with a lorry at the end of it.
    for (const status of ["open", "withdrawn", "expired"] as const) {
      expect(
        canRequest({ negotiation: settled({ status }), agency: agency(), ...base }),
      ).toMatchObject({ ok: false, code: "notAgreed" });
    }
  });

  it("refuses an agency that does not do transport", () => {
    expect(
      canRequest({ negotiation: settled(), agency: agency({ services: ["manpower"] }), ...base }),
    ).toMatchObject({ ok: false, code: "agencyUnavailable" });
  });

  it("refuses an agency whose paperwork has lapsed", () => {
    // Not pedantry: the load it carries would be uninsured, and the platform
    // arranged the movement.
    const lapsed = agency({
      documents: [{ kind: "gst", reference: "X", expiresAt: new Date(CLOCK - 1) }],
    });
    expect(canRequest({ negotiation: settled(), agency: lapsed, ...base })).toMatchObject({
      ok: false,
      code: "agencyUnavailable",
    });
  });

  it("refuses a suspended or unverified agency", () => {
    for (const status of ["pending", "suspended", "rejected"] as const) {
      expect(
        canRequest({ negotiation: settled(), agency: agency({ status }), ...base }),
      ).toMatchObject({ ok: false, code: "agencyUnavailable" });
    }
  });

  it("refuses an agency that does not cover the district", () => {
    expect(
      canRequest({ negotiation: settled(), agency: agency(), ...base, pickupDistrict: "Salem" }),
    ).toMatchObject({ ok: false, code: "outsideCoverage" });
  });

  it("refuses a second request while one is live", () => {
    for (const status of ["requested", "accepted"] as const) {
      expect(
        canRequest({
          negotiation: settled(),
          agency: agency(),
          existing: {
            negotiationId: "N-1",
            agencyId: "AG-1",
            agencyName: "Someone",
            status,
            requestedAt: NOW,
            pickupDistrict: "Erode",
            produceName: "Tomato",
            quantity: 400,
            unit: "kg",
          },
          ...base,
        }),
      ).toMatchObject({ ok: false, code: "alreadyArranged" });
    }
  });

  it("lets the farmer try again after a decline or a cancellation", () => {
    for (const status of ["declined", "cancelled"] as const) {
      expect(
        canRequest({
          negotiation: settled(),
          agency: agency(),
          existing: {
            negotiationId: "N-1",
            agencyId: "AG-1",
            agencyName: "Someone",
            status,
            requestedAt: NOW,
            pickupDistrict: "Erode",
            produceName: "Tomato",
            quantity: 400,
            unit: "kg",
          },
          ...base,
        }),
      ).toEqual({ ok: true });
    }
  });

  it("starts as requested, never as accepted", () => {
    // The agency agrees to carry it. The farmer asking is not the agency
    // answering, and a request that granted itself would put a lorry in the
    // diary of somebody who never saw it.
    expect(requestDispatch(settled(), agency(), "Erode", NOW).status).toBe("requested");
  });
});

describe("which agencies a farmer sees", () => {
  it("lists only those that could actually collect, by name", () => {
    const all = [
      agency({ id: "AG-1", name: "Zeta Carriers" }),
      agency({ id: "AG-2", name: "Alpha Loads" }),
      agency({ id: "AG-3", name: "Wrong District", districts: ["Salem"] }),
      agency({ id: "AG-4", name: "Crew Only", services: ["manpower"] }),
      agency({ id: "AG-5", name: "Suspended", status: "suspended" }),
    ];
    expect(availableAgencies(all, "Erode", CLOCK).map((a) => a.name)).toEqual([
      "Alpha Loads",
      "Zeta Carriers",
    ]);
  });

  it("returns nothing rather than everything when none fit", () => {
    expect(availableAgencies([agency({ districts: ["Salem"] })], "Erode", CLOCK)).toEqual([]);
  });
});
