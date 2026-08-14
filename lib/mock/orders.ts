import type { BuyerOrder } from "@/lib/domain/orders";

/**
 * Seeded buyer orders.
 *
 * Covers every state the console has to render, including the awkward ones:
 * an order still awaiting payment confirmation, two sitting unallocated, one
 * refunded after payment, and one whose assigned vehicle has since had its
 * insurance lapse — which the dispatch board must catch.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function buyerOrders(now: Date): BuyerOrder[] {
  const t = now.getTime();
  const buyer = "Kongu Agri Traders";

  return [
    {
      id: "O-7741",
      reference: "KAT-7741",
      status: "paid",
      placedAt: new Date(t - 40 * MINUTE),
      buyerName: buyer,
      districtId: "tn-krishnagiri",
      district: "Krishnagiri",
      stops: ["Kaveripattinam"],
      distanceKm: 34,
      paidAt: new Date(t - 38 * MINUTE),
      lines: [
        { produceId: "tomato", produceName: "Tomato", emoji: "🍅", grade: "a", unit: "kg", quantity: 800, unitPrice: 2600 },
        { produceId: "tomato", produceName: "Tomato", emoji: "🍅", grade: "b", unit: "kg", quantity: 400, unitPrice: 2100 },
      ],
    },
    {
      id: "O-7739",
      reference: "KAT-7739",
      status: "paid",
      placedAt: new Date(t - 2 * HOUR),
      buyerName: buyer,
      districtId: "tn-erode",
      district: "Erode",
      stops: ["Bhavani", "Gobichettipalayam"],
      distanceKm: 96,
      paidAt: new Date(t - 2 * HOUR + 3 * MINUTE),
      lines: [
        { produceId: "banana", produceName: "Banana", emoji: "🍌", grade: "a", unit: "kg", quantity: 1500, unitPrice: 3300 },
        { produceId: "turmeric", produceName: "Turmeric", emoji: "🟡", grade: "a", unit: "quintal", quantity: 6, unitPrice: 806_000 },
      ],
    },
    {
      id: "O-7736",
      reference: "KAT-7736",
      status: "pendingPayment",
      placedAt: new Date(t - 12 * MINUTE),
      buyerName: buyer,
      districtId: "tn-salem",
      district: "Salem",
      stops: ["Thammampatti", "Attur"],
      distanceKm: 61,
      lines: [
        { produceId: "brinjal", produceName: "Brinjal", emoji: "🍆", grade: "a", unit: "crate", quantity: 30, unitPrice: 52_500 },
      ],
    },
    {
      id: "O-7728",
      reference: "KAT-7728",
      status: "allocated",
      placedAt: new Date(t - 5 * HOUR),
      buyerName: buyer,
      districtId: "tn-krishnagiri",
      district: "Krishnagiri",
      stops: ["Kaveripattinam"],
      distanceKm: 34,
      paidAt: new Date(t - 5 * HOUR),
      // Assigned before the policy lapsed. The dispatch board has to notice.
      vehicleRegistration: "TN 33 AZ 8890",
      driverName: "P. Rajkumar",
      expectedArrival: new Date(t + 2 * HOUR),
      lines: [
        { produceId: "mango", produceName: "Mango", emoji: "🥭", grade: "a", unit: "crate", quantity: 60, unitPrice: 112_000 },
      ],
    },
    {
      id: "O-7719",
      reference: "KAT-7719",
      status: "inTransit",
      placedAt: new Date(t - 9 * HOUR),
      buyerName: buyer,
      districtId: "tn-salem",
      district: "Salem",
      stops: ["Thammampatti", "Attur"],
      distanceKm: 61,
      paidAt: new Date(t - 9 * HOUR),
      vehicleRegistration: "TN 20 BA 4471",
      driverName: "S. Mani",
      expectedArrival: new Date(t + 75 * MINUTE),
      lines: [
        { produceId: "onion", produceName: "Onion", emoji: "🧅", grade: "a", unit: "bag", quantity: 40, unitPrice: 142_000 },
        { produceId: "chilli", produceName: "Green chilli", emoji: "🌶️", grade: "a", unit: "kg", quantity: 120, unitPrice: 7400 },
      ],
    },
    {
      id: "O-7705",
      reference: "KAT-7705",
      status: "delivered",
      placedAt: new Date(t - 28 * HOUR),
      buyerName: buyer,
      districtId: "tn-erode",
      district: "Erode",
      stops: ["Bhavani", "Gobichettipalayam"],
      distanceKm: 96,
      paidAt: new Date(t - 28 * HOUR),
      vehicleRegistration: "TN 39 GH 2044",
      driverName: "A. Vetrivel",
      deliveredAt: new Date(t - 90 * MINUTE),
      lines: [
        { produceId: "banana", produceName: "Banana", emoji: "🍌", grade: "b", unit: "kg", quantity: 900, unitPrice: 2750 },
      ],
    },
    {
      id: "O-7690",
      reference: "KAT-7690",
      status: "completed",
      placedAt: new Date(t - 3 * DAY),
      buyerName: buyer,
      districtId: "tn-thanjavur",
      district: "Thanjavur",
      stops: ["Kumbakonam"],
      distanceKm: 188,
      paidAt: new Date(t - 3 * DAY),
      vehicleRegistration: "TN 20 BA 4471",
      driverName: "S. Mani",
      deliveredAt: new Date(t - 2 * DAY),
      lines: [
        { produceId: "groundnut", produceName: "Groundnut", emoji: "🥜", grade: "a", unit: "quintal", quantity: 14, unitPrice: 668_000 },
      ],
    },
    {
      id: "O-7688",
      reference: "KAT-7688",
      status: "refunded",
      placedAt: new Date(t - 4 * DAY),
      buyerName: buyer,
      districtId: "tn-salem",
      district: "Salem",
      stops: ["Thammampatti", "Attur"],
      distanceKm: 61,
      paidAt: new Date(t - 4 * DAY),
      refundedAt: new Date(t - 4 * DAY + 3 * HOUR),
      lines: [
        { produceId: "drumstick", produceName: "Drumstick", emoji: "🌿", grade: "a", unit: "kg", quantity: 200, unitPrice: 5300 },
      ],
    },
  ];
}
