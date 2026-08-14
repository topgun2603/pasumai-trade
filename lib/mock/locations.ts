import type { District, Geography, Place, State } from "@/lib/domain/location";

/**
 * Seeded geography.
 *
 * Tamil Nadu is live; the other states are registered but inactive, so the
 * structure that the platform grows into already exists rather than being
 * retrofitted. An inactive state does not appear in any dropdown.
 *
 * Villages carry coordinates, not distances: how far a village is depends on
 * which buyer is asking, so it is computed per pair rather than stored. Native
 * names need review by a native speaker before release, same caveat as the
 * crop catalogue.
 */

const STATES: State[] = [
  {
    id: "tn",
    name: "Tamil Nadu",
    nativeName: "தமிழ்நாடு",
    locale: "ta",
    vehiclePrefix: "TN",
    active: true,
  },
  {
    id: "ka",
    name: "Karnataka",
    nativeName: "ಕರ್ನಾಟಕ",
    locale: "kn",
    vehiclePrefix: "KA",
    active: false,
  },
  {
    id: "ap",
    name: "Andhra Pradesh",
    nativeName: "ఆంధ్రప్రదేశ్",
    locale: "te",
    vehiclePrefix: "AP",
    active: false,
  },
  {
    id: "kl",
    name: "Kerala",
    nativeName: "കേരളം",
    locale: "ml",
    vehiclePrefix: "KL",
    active: false,
  },
];

const DISTRICT_ROWS: Array<
  [string, string, string, string, boolean, number | null]
> = [
  // id, stateId, name, nativeName, active, minOrderValue (paise, null = default)
  ["tn-krishnagiri", "tn", "Krishnagiri", "கிருஷ்ணகிரி", true, 1_500_000],
  ["tn-dharmapuri", "tn", "Dharmapuri", "தர்மபுரி", true, 1_600_000],
  ["tn-salem", "tn", "Salem", "சேலம்", true, 1_200_000],
  ["tn-erode", "tn", "Erode", "ஈரோடு", true, 2_000_000],
  ["tn-tiruppur", "tn", "Tiruppur", "திருப்பூர்", true, 2_200_000],
  ["tn-thanjavur", "tn", "Thanjavur", "தஞ்சாவூர்", true, 2_500_000],
  ["tn-coimbatore", "tn", "Coimbatore", "கோயம்புத்தூர்", false, null],
  ["ka-kolar", "ka", "Kolar", "ಕೋಲಾರ", false, null],
  ["ka-bengaluru-rural", "ka", "Bengaluru Rural", "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ", false, null],
  ["ap-chittoor", "ap", "Chittoor", "చిత్తూరు", false, null],
];

const PLACE_ROWS: Array<
  [string, string, string, string, string, number, number, number]
> = [
  // id, districtId, name, nativeName, pincode, lat, lng, farmerCount
  ["tn-kaveripattinam", "tn-krishnagiri", "Kaveripattinam", "காவேரிப்பட்டினம்", "635112", 12.4204, 78.2166, 41],
  ["tn-hosur", "tn-krishnagiri", "Hosur", "ஓசூர்", "635109", 12.7409, 77.8253, 12],
  ["tn-bargur", "tn-krishnagiri", "Bargur", "பர்கூர்", "635104", 12.5316, 78.3556, 9],
  ["tn-pennagaram", "tn-dharmapuri", "Pennagaram", "பென்னாகரம்", "636810", 12.1345, 77.8944, 18],
  ["tn-palacode", "tn-dharmapuri", "Palacode", "பாலக்கோடு", "636808", 12.3106, 78.0619, 11],
  ["tn-thammampatti", "tn-salem", "Thammampatti", "தம்மம்பட்டி", "636113", 11.5333, 78.6167, 24],
  ["tn-attur", "tn-salem", "Attur", "ஆத்தூர்", "636102", 11.5943, 78.6014, 17],
  ["tn-bhavani", "tn-erode", "Bhavani", "பவானி", "638301", 11.4453, 77.6819, 52],
  ["tn-gobichettipalayam", "tn-erode", "Gobichettipalayam", "கோபிசெட்டிபாளையம்", "638452", 11.4552, 77.4423, 36],
  ["tn-avinashi", "tn-tiruppur", "Avinashi", "அவினாசி", "641654", 11.1929, 77.2686, 21],
  ["tn-kumbakonam", "tn-thanjavur", "Kumbakonam", "கும்பகோணம்", "612001", 10.9601, 79.3788, 33],
  ["tn-papanasam", "tn-thanjavur", "Papanasam", "பாபநாசம்", "614205", 10.9265, 79.2705, 21],
];

const DISTRICTS: District[] = DISTRICT_ROWS.map(
  ([id, stateId, name, nativeName, active, minOrderValue]) => ({
    id,
    stateId,
    name,
    nativeName,
    minOrderValue,
    active,
  }),
);

const PLACES: Place[] = PLACE_ROWS.map(
  ([id, districtId, name, nativeName, pincode, lat, lng, farmerCount]) => ({
    id,
    districtId,
    name,
    nativeName,
    pincode,
    lat,
    lng,
    farmerCount,
    active: true,
  }),
);

export const GEOGRAPHY: Geography = {
  states: STATES,
  districts: DISTRICTS,
  places: PLACES,
};

/** Active district names, for the places that still take a plain string. */
export const DISTRICT_NAMES: string[] = DISTRICTS.filter((d) => d.active).map(
  (d) => d.name,
);

/** Resolve a district by name — bridges the string-keyed mock data. */
export function districtByName(name: string): District | undefined {
  return DISTRICTS.find((d) => d.name === name);
}

export function placeByName(name: string): Place | undefined {
  return PLACES.find((p) => p.name === name);
}
