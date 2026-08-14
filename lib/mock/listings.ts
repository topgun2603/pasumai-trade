import type { FarmerSummary, Listing, MarketRate } from "@/lib/domain/models";

import { CATALOGUE } from "./catalogue";

/**
 * An in-memory stand-in for the listings a franchise sees.
 *
 * This mirrors what `MockFarmerRepository` does in the Flutter app: seed a
 * realistic scenario so every screen can be built and demonstrated before the
 * backend exists. Replace with a Firestore query behind the same shape.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const FARMERS: Record<string, FarmerSummary> = {
  murugan: {
    id: "f-201",
    name: "R. Murugan",
    village: "Kaveripattinam",
    district: "Krishnagiri",
    completedOrders: 34,
  },
  lakshmi: {
    id: "f-207",
    name: "S. Lakshmi",
    village: "Pennagaram",
    district: "Dharmapuri",
    completedOrders: 12,
  },
  arumugam: {
    id: "f-214",
    name: "K. Arumugam",
    village: "Bhavani",
    district: "Erode",
    completedOrders: 61,
  },
  selvi: {
    id: "f-219",
    name: "M. Selvi",
    village: "Thammampatti",
    district: "Salem",
    completedOrders: 3,
  },
  ganesan: {
    id: "f-223",
    name: "P. Ganesan",
    village: "Kumbakonam",
    district: "Thanjavur",
    completedOrders: 27,
  },
  vetrivel: {
    id: "f-231",
    name: "A. Vetrivel",
    village: "Avinashi",
    district: "Tiruppur",
    completedOrders: 19,
  },
  kamala: {
    id: "f-238",
    name: "D. Kamala",
    village: "Hosur",
    district: "Krishnagiri",
    completedOrders: 8,
  },
};

/**
 * Rates are in minor units per listed unit. The `source` string is shown to
 * the farmer verbatim, so a platform average must never be labelled as a mandi
 * price — the honesty of this field is the whole trust argument of the offer
 * screen.
 */
function rate(
  low: number,
  high: number,
  district: string,
  source: string,
  asOf: Date,
): MarketRate {
  return { low, high, district, source, asOf };
}

export function openListings(now: Date): Listing[] {
  const t = now.getTime();
  const today = new Date(t - 5 * HOUR);
  const yesterday = new Date(t - 29 * HOUR);

  return [
    {
      id: "L-4821",
      produce: CATALOGUE.tomato,
      farmer: FARMERS.murugan,
      quantity: 1180,
      unit: "kg",
      status: "awaitingOffer",
      createdAt: new Date(t - 42 * MINUTE),
      photoCount: 3,
      pendingSync: false,
      marketRate: rate(
        1850,
        2400,
        "Krishnagiri",
        "Agmarknet · Krishnagiri mandi",
        today,
      ),
    },
    {
      id: "L-4819",
      produce: CATALOGUE.banana,
      farmer: FARMERS.arumugam,
      quantity: 2400,
      unit: "kg",
      status: "awaitingOffer",
      createdAt: new Date(t - 2 * HOUR - 15 * MINUTE),
      photoCount: 5,
      pendingSync: false,
      marketRate: rate(2900, 3450, "Erode", "Agmarknet · Erode mandi", today),
    },
    {
      id: "L-4816",
      produce: CATALOGUE.turmeric,
      farmer: FARMERS.vetrivel,
      quantity: 18,
      unit: "quintal",
      status: "offered",
      createdAt: new Date(t - 4 * HOUR),
      photoCount: 2,
      pendingSync: false,
      marketRate: rate(
        712_000,
        848_000,
        "Tiruppur",
        "Agmarknet · Erode turmeric market",
        today,
      ),
      offer: {
        id: "O-2291",
        franchiseName: "Kongu Agri Traders",
        bands: [
          { grade: "a", ratePerUnit: 806_000 },
          { grade: "b", ratePerUnit: 742_000 },
          { grade: "c", ratePerUnit: 655_000 },
        ],
        expiresAt: new Date(t + 47 * MINUTE),
        marketRate: rate(
          712_000,
          848_000,
          "Tiruppur",
          "Agmarknet · Erode turmeric market",
          today,
        ),
      },
    },
    {
      id: "L-4812",
      produce: CATALOGUE.onion,
      farmer: FARMERS.lakshmi,
      quantity: 62,
      unit: "bag",
      status: "awaitingOffer",
      createdAt: new Date(t - 6 * HOUR - 40 * MINUTE),
      photoCount: 0,
      pendingSync: true,
      marketRate: rate(
        118_000,
        142_000,
        "Dharmapuri",
        "Platform 7-day average",
        yesterday,
      ),
    },
    {
      id: "L-4808",
      produce: CATALOGUE.brinjal,
      farmer: FARMERS.selvi,
      quantity: 40,
      unit: "crate",
      status: "awaitingOffer",
      createdAt: new Date(t - 9 * HOUR),
      photoCount: 4,
      pendingSync: false,
      marketRate: rate(
        41_000,
        52_500,
        "Salem",
        "Agmarknet · Salem mandi",
        yesterday,
      ),
    },
    {
      id: "L-4803",
      produce: CATALOGUE.groundnut,
      farmer: FARMERS.ganesan,
      quantity: 26,
      unit: "quintal",
      status: "offered",
      createdAt: new Date(t - 22 * HOUR),
      photoCount: 3,
      pendingSync: false,
      marketRate: rate(
        624_000,
        691_000,
        "Thanjavur",
        "Agmarknet · Thanjavur mandi",
        yesterday,
      ),
      offer: {
        id: "O-2284",
        franchiseName: "Kongu Agri Traders",
        bands: [
          { grade: "a", ratePerUnit: 668_000 },
          { grade: "b", ratePerUnit: 612_000 },
          { grade: "c", ratePerUnit: 548_000 },
        ],
        // Already gone. Ranks as expired, not as awaiting a response.
        expiresAt: new Date(t - 90 * MINUTE),
        marketRate: rate(
          624_000,
          691_000,
          "Thanjavur",
          "Agmarknet · Thanjavur mandi",
          yesterday,
        ),
      },
    },
    {
      id: "L-4799",
      produce: CATALOGUE.mango,
      farmer: FARMERS.kamala,
      quantity: 88,
      unit: "crate",
      status: "awaitingOffer",
      createdAt: new Date(t - 26 * HOUR),
      photoCount: 6,
      pendingSync: false,
      marketRate: rate(
        86_000,
        112_000,
        "Krishnagiri",
        "Agmarknet · Krishnagiri mandi",
        yesterday,
      ),
    },
    {
      id: "L-4794",
      produce: CATALOGUE.drumstick,
      farmer: FARMERS.murugan,
      quantity: 310,
      unit: "kg",
      status: "offered",
      createdAt: new Date(t - 31 * HOUR),
      photoCount: 2,
      pendingSync: false,
      marketRate: rate(
        4200,
        5600,
        "Krishnagiri",
        "Agmarknet · Krishnagiri mandi",
        yesterday,
      ),
      offer: {
        id: "O-2276",
        franchiseName: "Kongu Agri Traders",
        bands: [
          { grade: "a", ratePerUnit: 5300 },
          { grade: "b", ratePerUnit: 4700 },
          { grade: "c", ratePerUnit: 3900 },
        ],
        expiresAt: new Date(t + 5 * HOUR + 20 * MINUTE),
        marketRate: rate(
          4200,
          5600,
          "Krishnagiri",
          "Agmarknet · Krishnagiri mandi",
          yesterday,
        ),
      },
    },
    {
      id: "L-4788",
      produce: CATALOGUE.chilli,
      farmer: FARMERS.selvi,
      quantity: 145,
      unit: "kg",
      status: "awaitingOffer",
      createdAt: new Date(t - 38 * HOUR),
      photoCount: 1,
      pendingSync: false,
      marketRate: rate(5800, 7400, "Salem", "Platform 7-day average", yesterday),
    },
  ];
}

export const DISTRICTS = [
  "Krishnagiri",
  "Dharmapuri",
  "Salem",
  "Erode",
  "Thanjavur",
  "Tiruppur",
] as const;

/** The signed-in franchise. Replaced by the session once auth lands. */
export const CURRENT_FRANCHISE = {
  name: "Kongu Agri Traders",
  code: "KAT-07",
  districts: ["Krishnagiri", "Dharmapuri", "Salem", "Erode", "Thanjavur", "Tiruppur"],
};
