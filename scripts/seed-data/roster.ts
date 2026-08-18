/**
 * Seed input, not application data.
 *
 * This was `lib/mock/admin`, and twenty-one screens read it as though it were a
 * record of the platform. It is not: it is the fixture set `scripts/seed.ts`
 * writes into Firestore so a fresh project has something in it.
 *
 * It lives beside the seeder now so that distinction is structural rather than
 * a matter of remembering. Nothing under `app/`, `components/` or `lib/` should
 * import it — those read the collections, through `lib/firebase/roster-read.ts`.
 */

﻿import type {
  Agency,
  BuyerAccount,
  ComplianceDocument,
  DriverAccount,
  FarmerAccount,
  Worker,
  Vehicle,
} from "@/lib/domain/admin";
import { money, rupees } from "@/lib/domain/money";

/**
 * Seeded administration data.
 *
 * Stands in for Firestore queries. Deliberately includes the awkward cases an
 * admin console exists for: lapsed insurance, a driver whose licence expires
 * this month, a suspended account, and registrations sitting unreviewed.
 */

const DAY = 86_400_000;

function doc(
  kind: ComplianceDocument["kind"],
  reference: string,
  expiresInDays: number | null,
  now: number,
  verified = true,
): ComplianceDocument {
  return {
    kind,
    reference,
    expiresAt: expiresInDays === null ? undefined : new Date(now + expiresInDays * DAY),
    verifiedAt: verified ? new Date(now - 45 * DAY) : undefined,
  };
}

export function buyerAccounts(now: Date): BuyerAccount[] {
  const t = now.getTime();
  return [
    {
      id: "B-1001",
      name: "Kongu Agri Traders",
      kind: "franchise",
      contactName: "V. Senthil",
      mobile: "+91 98430 11204",
      town: "Hosur",
      district: "Krishnagiri",
      districts: ["Krishnagiri", "Dharmapuri", "Salem"],
      status: "verified",
      registeredAt: new Date(t - 412 * DAY),
      ordersPlaced: 486,
      // Written in rupees. `money()` takes paise, and Indian digit grouping
      // makes that an easy hundredfold mistake to read straight past.
      lifetimeValue: rupees(11_240_000),
      photoUrl: "/mock/premises.svg",
      documents: [
        doc("gst", "33AAECK4521M1ZP", null, t),
        doc("pan", "AAECK4521M", null, t),
        doc("fssai", "12421064000318", 210, t),
        doc("bankProof", "HDFC ····4471", null, t),
      ],
    },
    {
      id: "B-1007",
      name: "Bhavani Fresh Supplies",
      kind: "franchise",
      contactName: "R. Anitha",
      mobile: "+91 94421 77310",
      town: "Bhavani",
      district: "Erode",
      districts: ["Erode", "Tiruppur"],
      status: "verified",
      registeredAt: new Date(t - 288 * DAY),
      ordersPlaced: 312,
      lifetimeValue: rupees(7_180_000),
      photoUrl: "/mock/premises.svg",
      documents: [
        doc("gst", "33AAGCB1178K1Z4", null, t),
        doc("pan", "AAGCB1178K", null, t),
        doc("fssai", "12421064000992", 18, t),
        doc("bankProof", "IOB ····2290", null, t),
      ],
    },
    {
      id: "B-1014",
      name: "Sri Annapoorna Hotels",
      kind: "independent",
      contactName: "M. Karthik",
      mobile: "+91 90031 45521",
      town: "Coimbatore",
      district: "Coimbatore",
      districts: ["Erode", "Tiruppur", "Salem"],
      status: "verified",
      registeredAt: new Date(t - 96 * DAY),
      ordersPlaced: 74,
      lifetimeValue: rupees(1_310_000),
      documents: [
        doc("gst", "33AABCS9012F1ZQ", null, t),
        doc("fssai", "12420064001177", 340, t),
      ],
    },
    {
      id: "B-1019",
      name: "Thanjavur Wholesale Mandi",
      kind: "independent",
      contactName: "S. Palanivel",
      mobile: "+91 98651 30078",
      town: "Kumbakonam",
      district: "Thanjavur",
      districts: ["Thanjavur"],
      status: "pending",
      registeredAt: new Date(t - 3 * DAY),
      ordersPlaced: 0,
      lifetimeValue: money(0),
      documents: [
        doc("gst", "33AAFCT2210J1ZS", null, t, false),
        doc("pan", "AAFCT2210J", null, t, false),
      ],
    },
    {
      id: "B-1022",
      name: "Nilgiris Produce Company",
      kind: "independent",
      contactName: "J. Ravi",
      mobile: "+91 94880 22145",
      town: "Mettupalayam",
      district: "Coimbatore",
      districts: ["Erode"],
      status: "pending",
      registeredAt: new Date(t - 1 * DAY),
      ordersPlaced: 0,
      lifetimeValue: money(0),
      documents: [doc("gst", "33AACCN7781L1ZB", null, t, false)],
    },
    {
      id: "B-1009",
      name: "Salem Star Vegetables",
      kind: "franchise",
      contactName: "K. Devi",
      mobile: "+91 97890 66412",
      town: "Thammampatti",
      district: "Salem",
      districts: ["Salem"],
      status: "suspended",
      registeredAt: new Date(t - 520 * DAY),
      ordersPlaced: 198,
      lifetimeValue: rupees(3_960_000),
      documents: [
        doc("gst", "33AAJCS4410N1ZG", null, t),
        doc("fssai", "12421064002050", -22, t),
      ],
    },
  ];
}

export function farmerAccounts(now: Date): FarmerAccount[] {
  const t = now.getTime();
  return [
    {
      id: "F-201",
      name: "R. Murugan",
      mobile: "+91 90478 21134",
      village: "Kaveripattinam",
      district: "Krishnagiri",
      bankAccountTail: "4471",
      status: "verified",
      registeredAt: new Date(t - 340 * DAY),
      registeredBy: "Kongu Agri Traders",
      activeListings: 2,
      completedOrders: 34,
      photoUrl: "/mock/portrait.svg",
      landPhotoUrl: "/mock/field.svg",
      documents: [doc("aadhaar", "XXXX XXXX 1134", null, t), doc("bankProof", "IOB ····4471", null, t)],
    },
    {
      id: "F-214",
      name: "K. Arumugam",
      mobile: "+91 94433 90210",
      village: "Bhavani",
      district: "Erode",
      bankAccountTail: "9021",
      status: "verified",
      registeredAt: new Date(t - 610 * DAY),
      registeredBy: "Bhavani Fresh Supplies",
      activeListings: 1,
      completedOrders: 61,
      photoUrl: "/mock/portrait.svg",
      landPhotoUrl: "/mock/field.svg",
      documents: [doc("aadhaar", "XXXX XXXX 9021", null, t), doc("bankProof", "SBI ····9021", null, t)],
    },
    {
      id: "F-219",
      name: "M. Selvi",
      mobile: "+91 96001 77450",
      village: "Thammampatti",
      district: "Salem",
      bankAccountTail: "7745",
      status: "verified",
      registeredAt: new Date(t - 58 * DAY),
      registeredBy: "Salem Star Vegetables",
      activeListings: 2,
      completedOrders: 3,
      photoUrl: "/mock/portrait.svg",
      documents: [doc("aadhaar", "XXXX XXXX 7745", null, t), doc("bankProof", "Canara ····7745", null, t)],
    },
    {
      id: "F-241",
      name: "T. Ezhilarasi",
      mobile: "+91 93454 11982",
      village: "Pennagaram",
      district: "Dharmapuri",
      bankAccountTail: "1198",
      status: "pending",
      registeredAt: new Date(t - 2 * DAY),
      registeredBy: "Kongu Agri Traders",
      activeListings: 0,
      completedOrders: 0,
      documents: [doc("aadhaar", "XXXX XXXX 1198", null, t, false)],
    },
    {
      id: "F-243",
      name: "N. Chandran",
      mobile: "+91 90920 33417",
      village: "Avinashi",
      district: "Tiruppur",
      bankAccountTail: "3341",
      status: "pending",
      registeredAt: new Date(t - 5 * DAY),
      registeredBy: "Bhavani Fresh Supplies",
      activeListings: 0,
      completedOrders: 0,
      documents: [],
    },
    {
      id: "F-188",
      name: "G. Palaniammal",
      mobile: "+91 98942 55013",
      village: "Kumbakonam",
      district: "Thanjavur",
      bankAccountTail: "5501",
      status: "rejected",
      registeredAt: new Date(t - 71 * DAY),
      registeredBy: "Thanjavur Wholesale Mandi",
      activeListings: 0,
      completedOrders: 0,
      documents: [doc("aadhaar", "XXXX XXXX 5501", null, t, false)],
    },
  ];
}

export function driverAccounts(now: Date): DriverAccount[] {
  const t = now.getTime();
  return [
    {
      id: "D-301",
      agencyId: "AG-102",
      name: "S. Mani",
      mobile: "+91 98404 22190",
      district: "Krishnagiri",
      status: "verified",
      registeredAt: new Date(t - 300 * DAY),
      tripsCompleted: 412,
      assignedVehicle: "TN 20 BA 4471",
      photoUrl: "/mock/portrait.svg",
      documents: [doc("drivingLicence", "TN20 20180004471", 480, t), doc("aadhaar", "XXXX XXXX 2219", null, t)],
    },
    {
      id: "D-308",
      agencyId: "AG-105",
      name: "P. Rajkumar",
      mobile: "+91 94422 77801",
      district: "Erode",
      status: "verified",
      registeredAt: new Date(t - 220 * DAY),
      tripsCompleted: 268,
      assignedVehicle: "TN 33 AZ 8890",
      photoUrl: "/mock/portrait.svg",
      // Licence lapses inside the month â€” the driver is still dispatchable
      // today, which is exactly why this needs surfacing now.
      documents: [doc("drivingLicence", "TN33 20160007780", 12, t), doc("aadhaar", "XXXX XXXX 7780", null, t)],
    },
    {
      id: "D-315",
      agencyId: "AG-102",
      name: "A. Vetrivel",
      mobile: "+91 90031 88220",
      district: "Salem",
      status: "verified",
      registeredAt: new Date(t - 140 * DAY),
      tripsCompleted: 96,
      assignedVehicle: "TN 30 CD 1120",
      photoUrl: "/mock/portrait.svg",
      documents: [doc("drivingLicence", "TN30 20190008822", -6, t), doc("aadhaar", "XXXX XXXX 8822", null, t)],
    },
    {
      id: "D-322",
      agencyId: "AG-105",
      name: "M. Iyyappan",
      mobile: "+91 97911 40036",
      district: "Thanjavur",
      status: "pending",
      registeredAt: new Date(t - 4 * DAY),
      tripsCompleted: 0,
      documents: [doc("drivingLicence", "TN49 20210004003", 620, t, false)],
    },
    {
      id: "D-327",
      agencyId: "AG-105",
      name: "R. Saravanan",
      mobile: "+91 93601 29954",
      district: "Tiruppur",
      status: "pending",
      registeredAt: new Date(t - 1 * DAY),
      tripsCompleted: 0,
      documents: [],
    },
  ];
}

export function vehicles(now: Date): Vehicle[] {
  const t = now.getTime();
  return [
    {
      id: "V-401",
      agencyId: "AG-102",
      registration: "TN 20 BA 4471",
      type: "miniTruck",
      capacityKg: 1500,
      owner: "Kongu Agri Traders",
      district: "Krishnagiri",
      status: "verified",
      registeredAt: new Date(t - 300 * DAY),
      assignedDriver: "S. Mani",
      refrigerated: false,
      photoUrl: "/mock/truck.svg",
      documents: [
        doc("rc", "TN20BA4471", null, t),
        doc("insurance", "OIC/2025/884210", 190, t),
        doc("fitness", "FC-TN20-88421", 240, t),
        doc("permit", "NP-TN20-11204", 300, t),
      ],
    },
    {
      id: "V-408",
      agencyId: "AG-105",
      registration: "TN 33 AZ 8890",
      type: "truck",
      capacityKg: 9000,
      owner: "Bhavani Fresh Supplies",
      district: "Erode",
      status: "verified",
      registeredAt: new Date(t - 500 * DAY),
      assignedDriver: "P. Rajkumar",
      refrigerated: false,
      photoUrl: "/mock/truck.svg",
      documents: [
        doc("rc", "TN33AZ8890", null, t),
        // Lapsed. Any load on this vehicle is uninsured.
        doc("insurance", "NIC/2024/551002", -9, t),
        doc("fitness", "FC-TN33-55100", 120, t),
        doc("permit", "NP-TN33-77801", 88, t),
      ],
    },
    {
      id: "V-412",
      agencyId: "AG-105",
      registration: "TN 30 CD 1120",
      type: "reefer",
      capacityKg: 4000,
      owner: "Salem Star Vegetables",
      district: "Salem",
      status: "verified",
      registeredAt: new Date(t - 180 * DAY),
      assignedDriver: "A. Vetrivel",
      refrigerated: true,
      photoUrl: "/mock/reefer.svg",
      documents: [
        doc("rc", "TN30CD1120", null, t),
        doc("insurance", "UIIC/2025/220145", 26, t),
        doc("fitness", "FC-TN30-22014", 21, t),
        doc("permit", "NP-TN30-88220", 410, t),
      ],
    },
    {
      id: "V-419",
      agencyId: "AG-102",
      registration: "TN 49 EF 6602",
      type: "tempo",
      capacityKg: 850,
      owner: "M. Iyyappan",
      district: "Thanjavur",
      status: "pending",
      registeredAt: new Date(t - 4 * DAY),
      refrigerated: false,
      documents: [
        doc("rc", "TN49EF6602", null, t, false),
        doc("insurance", "TATA/2025/660211", 330, t, false),
      ],
    },
    {
      id: "V-423",
      agencyId: "AG-102",
      registration: "TN 39 GH 2044",
      type: "miniTruck",
      capacityKg: 1200,
      owner: "Bhavani Fresh Supplies",
      district: "Tiruppur",
      status: "verified",
      registeredAt: new Date(t - 92 * DAY),
      refrigerated: false,
      photoUrl: "/mock/truck.svg",
      documents: [
        doc("rc", "TN39GH2044", null, t),
        doc("insurance", "OIC/2025/204411", 415, t),
        doc("fitness", "FC-TN39-20441", 380, t),
        doc("permit", "NP-TN39-29954", 200, t),
      ],
    },
  ];
}

/**
 * Registered crew.
 *
 * Deliberately spans the states that matter to the screen: a verified hand
 * ready to work, one whose bank proof has lapsed, one awaiting review, and one
 * verified but off the roster — because "cannot be dispatched" has four
 * different causes and the console has to tell them apart.
 */
export function workers(now: Date): Worker[] {
  const t = now.getTime();
  return [
    {
      id: "M-501",
      agencyId: "AG-101",
      name: "K. Ravi",
      mobile: "+91 90031 44872",
      district: "Krishnagiri",
      place: "Kaveripattinam",
      skills: ["loading", "weighing"],
      basis: "perTrip",
      rate: 45_000,
      status: "verified",
      registeredAt: new Date(t - 240 * DAY),
      jobsCompleted: 318,
      available: true,
      photoUrl: "/mock/portrait.svg",
      documents: [
        doc("aadhaar", "XXXX XXXX 4487", null, t),
        doc("bankProof", "KVB 0091 4487", null, t),
      ],
    },
    {
      id: "M-509",
      agencyId: "AG-101",
      name: "A. Devi",
      mobile: "+91 97865 20114",
      district: "Krishnagiri",
      place: "Bargur",
      // Grading is the skill in shortest supply: it decides what the farmer is
      // paid, so it is the one the platform is most careful about.
      skills: ["grading", "packing"],
      basis: "daily",
      rate: 70_000,
      status: "verified",
      registeredAt: new Date(t - 180 * DAY),
      jobsCompleted: 205,
      available: true,
      photoUrl: "/mock/portrait.svg",
      documents: [
        doc("aadhaar", "XXXX XXXX 2011", null, t),
        doc("bankProof", "IOB 4410 2011", null, t),
      ],
    },
    {
      id: "M-514",
      agencyId: "AG-104",
      name: "M. Sekar",
      mobile: "+91 94438 71209",
      district: "Erode",
      place: "Bhavani",
      skills: ["loading"],
      basis: "perTrip",
      rate: 40_000,
      status: "verified",
      registeredAt: new Date(t - 130 * DAY),
      jobsCompleted: 142,
      // Verified, compliant, and simply not working this month. Not a problem
      // to escalate — but not someone to assign either.
      available: false,
      photoUrl: "/mock/portrait.svg",
      documents: [
        doc("aadhaar", "XXXX XXXX 7120", null, t),
        doc("bankProof", "SBI 3320 7120", null, t),
      ],
    },
    {
      id: "M-522",
      agencyId: "AG-107",
      name: "R. Kalaiselvi",
      mobile: "+91 98651 33076",
      district: "Salem",
      place: "Attur",
      skills: ["grading", "weighing", "coldChain"],
      basis: "monthly",
      rate: 1_800_000,
      status: "pending",
      registeredAt: new Date(t - 6 * DAY),
      jobsCompleted: 0,
      available: true,
      documents: [doc("aadhaar", "XXXX XXXX 3307", null, t)],
    },
    {
      id: "M-527",
      agencyId: "AG-105",
      name: "V. Gunasekaran",
      mobile: "+91 93601 88245",
      district: "Erode",
      place: "Gobichettipalayam",
      skills: ["loading", "coldChain"],
      basis: "perTrip",
      rate: 52_000,
      status: "verified",
      registeredAt: new Date(t - 150 * DAY),
      jobsCompleted: 176,
      available: true,
      photoUrl: "/mock/portrait.svg",
      documents: [
        doc("aadhaar", "XXXX XXXX 8824", null, t),
        doc("bankProof", "CUB 2201 8824", null, t),
      ],
    },
    {
      id: "M-530",
      agencyId: "AG-104",
      name: "S. Anbarasan",
      mobile: "+91 90475 66218",
      district: "Thanjavur",
      place: "Kumbakonam",
      skills: ["loading", "packing"],
      basis: "daily",
      rate: 65_000,
      status: "verified",
      registeredAt: new Date(t - 95 * DAY),
      jobsCompleted: 88,
      available: true,
      // Bank proof lapsed. They can work, but they cannot be paid, and the
      // console must show that before someone is sent out expecting money.
      documents: [
        doc("aadhaar", "XXXX XXXX 6621", null, t),
        doc("bankProof", "TMB 8890 6621", -9, t),
      ],
    },
  ];
}

/**
 * Contracted supplier companies.
 *
 * Spread across the states the console has to distinguish: a labour contractor
 * in good standing, a transport contractor whose own GST has lapsed, one that
 * does both, and one still awaiting review. An agency's own compliance gates
 * everything it registers — a verified driver working for a suspended agency
 * must not be dispatched, and the driver is not the problem.
 */
export function agencies(now: Date): Agency[] {
  const t = now.getTime();
  return [
    {
      id: "AG-101",
      name: "Kaveri Labour Services",
      services: ["manpower"],
      contactName: "N. Selvaraj",
      mobile: "+91 90031 55420",
      email: "selvaraj@kaverilabour.in",
      district: "Krishnagiri",
      town: "Kaveripattinam",
      districts: ["Krishnagiri", "Dharmapuri"],
      status: "verified",
      registeredAt: new Date(t - 320 * DAY),
      photoUrl: "/mock/premises.svg",
      documents: [
        doc("pan", "AAFCK4471K", null, t),
        doc("gst", "33AAFCK4471K1ZP", 300, t),
        doc("bankProof", "KVB 0091 5542", null, t),
      ],
    },
    {
      id: "AG-102",
      name: "Hosur Freight Lines",
      services: ["transport"],
      contactName: "R. Venkatesan",
      mobile: "+91 94422 30187",
      email: "ops@hosurfreight.in",
      district: "Krishnagiri",
      town: "Hosur",
      districts: ["Krishnagiri", "Dharmapuri", "Salem"],
      status: "verified",
      registeredAt: new Date(t - 400 * DAY),
      photoUrl: "/mock/premises.svg",
      documents: [
        doc("pan", "AABCH8890M", null, t),
        doc("gst", "33AABCH8890M1Z4", 210, t),
        doc("bankProof", "IOB 4410 3018", null, t),
      ],
    },
    {
      id: "AG-104",
      name: "Bhavani Crew Contractors",
      services: ["manpower"],
      contactName: "P. Anandhi",
      mobile: "+91 98651 44203",
      email: "anandhi@bhavanicrew.in",
      district: "Erode",
      town: "Bhavani",
      districts: ["Erode", "Tiruppur"],
      status: "verified",
      registeredAt: new Date(t - 210 * DAY),
      // GST lapsed last week. Everything this agency has registered is
      // grounded until it is renewed, which is exactly why agency compliance
      // is checked above the individual record.
      documents: [
        doc("pan", "AAGCB2044P", null, t),
        doc("gst", "33AAGCB2044P1ZQ", -6, t),
      ],
    },
    {
      id: "AG-105",
      name: "Kongu Transport & Manpower",
      // Both. A contractor supplying loaders usually supplies the vehicle they
      // load onto, and the console has to handle one login seeing two sections.
      services: ["transport", "manpower"],
      contactName: "M. Jayaraman",
      mobile: "+91 90475 71166",
      email: "jayaraman@kongutm.in",
      district: "Erode",
      town: "Gobichettipalayam",
      districts: ["Erode", "Salem", "Tiruppur"],
      status: "verified",
      registeredAt: new Date(t - 260 * DAY),
      photoUrl: "/mock/premises.svg",
      documents: [
        doc("pan", "AADCK7712R", null, t),
        doc("gst", "33AADCK7712R1ZM", 140, t),
        doc("bankProof", "TMB 8890 7116", null, t),
      ],
    },
    {
      id: "AG-107",
      name: "Attur Farm Crew",
      services: ["manpower"],
      contactName: "S. Kumaravel",
      mobile: "+91 97865 90014",
      email: "kumaravel@atturfarmcrew.in",
      district: "Salem",
      town: "Attur",
      districts: ["Salem"],
      status: "pending",
      registeredAt: new Date(t - 4 * DAY),
      documents: [doc("pan", "AAHCA9001T", null, t)],
    },
  ];
}
