import type { Produce } from "@/lib/domain/models";

/**
 * The produce catalogue.
 *
 * In production this is a Firestore collection edited by operations from
 * Admin → Controls, not code. It sits here until the backend lands.
 *
 * Every non-English name needs review by a native speaker familiar with
 * agricultural vocabulary. Crop names are the single most regional vocabulary
 * on the platform — which is why `regional` exists and why the control page
 * lets operations fix them without a deploy.
 */
export const CATALOGUE: Record<string, Produce> = {
  tomato: {
    id: "tomato",
    names: {
      en: "Tomato",
      ta: "தக்காளி",
      te: "టమాటా",
      kn: "ಟೊಮ್ಯಾಟೊ",
      ml: "തക്കാളി",
      hi: "टमाटर",
    },
    emoji: "🍅",
    defaultUnit: "kg",
    shelfLifeHours: 96,
    grading: {
      a: { en: "Firm, even red, 55mm+, no splits or sun-scald" },
      b: { en: "Ripe, minor blemish, 45mm+, under 5% split" },
      c: { en: "Soft or over-ripe, small, usable same day" },
    },
  },
  banana: {
    id: "banana",
    names: {
      en: "Banana",
      ta: "வாழைப்பழம்",
      te: "అరటిపండు",
      kn: "ಬಾಳೆಹಣ್ಣು",
      ml: "വാഴപ്പഴം",
      hi: "केला",
    },
    emoji: "🍌",
    defaultUnit: "kg",
    shelfLifeHours: 120,
    grading: {
      a: { en: "Full hands, even green, no bruising or latex stain" },
      b: { en: "Slight bruising, uneven hand size" },
      c: { en: "Ripening or bruised, sell locally" },
    },
  },
  onion: {
    id: "onion",
    names: {
      en: "Onion",
      ta: "வெங்காயம்",
      te: "ఉల్లిపాయ",
      kn: "ಈರುಳ್ಳಿ",
      ml: "സവാള",
      hi: "प्याज़",
    },
    emoji: "🧅",
    defaultUnit: "bag",
    shelfLifeHours: 480,
    grading: {
      a: { en: "Dry skin, 50mm+, single centre, no sprout" },
      b: { en: "Dry skin, 40mm+, minor doubles" },
      c: { en: "Small, doubles, or early sprout" },
    },
  },
  brinjal: {
    id: "brinjal",
    names: {
      en: "Brinjal",
      ta: "கத்தரிக்காய்",
      te: "వంకాయ",
      kn: "ಬದನೆಕಾಯಿ",
      ml: "വഴുതന",
      hi: "बैंगन",
    },
    emoji: "🍆",
    defaultUnit: "crate",
    shelfLifeHours: 52,
    grading: {
      a: { en: "Glossy, firm, straight, no borer holes" },
      b: { en: "Slight dullness or curve, no holes" },
      c: { en: "Dull, soft patches, or single borer mark" },
    },
  },
  turmeric: {
    id: "turmeric",
    names: {
      en: "Turmeric",
      ta: "மஞ்சள்",
      te: "పసుపు",
      kn: "ಅರಿಶಿನ",
      ml: "മഞ്ഞൾ",
      hi: "हल्दी",
    },
    emoji: "🟡",
    defaultUnit: "quintal",
    shelfLifeHours: 4000,
    grading: {
      a: { en: "Cured, hard, bright section, under 8% moisture" },
      b: { en: "Cured, some soft fingers, under 12% moisture" },
      c: { en: "Under-cured, or mother rhizome" },
    },
  },
  groundnut: {
    id: "groundnut",
    names: {
      en: "Groundnut",
      ta: "நிலக்கடலை",
      te: "వేరుశనగ",
      kn: "ಕಡಲೆಕಾಯಿ",
      ml: "നിലക്കടല",
      hi: "मूँगफली",
    },
    emoji: "🥜",
    defaultUnit: "quintal",
    shelfLifeHours: 2000,
    grading: {
      a: { en: "Dry, filled pods, under 8% moisture, no mould" },
      b: { en: "Under 10% moisture, some unfilled pods" },
      c: { en: "Shrivelled kernels, or over 12% moisture" },
    },
  },
  mango: {
    id: "mango",
    names: {
      en: "Mango",
      ta: "மாம்பழம்",
      te: "మామిడి",
      kn: "ಮಾವಿನಹಣ್ಣು",
      ml: "മാമ്പഴം",
      hi: "आम",
    },
    emoji: "🥭",
    defaultUnit: "crate",
    shelfLifeHours: 64,
    grading: {
      a: { en: "Mature, unblemished, even size, no sap burn" },
      b: { en: "Minor sap burn or size variation" },
      c: { en: "Blemished or over-mature, sell same day" },
    },
  },
  drumstick: {
    id: "drumstick",
    names: {
      en: "Drumstick",
      ta: "முருங்கைக்காய்",
      te: "మునగకాయ",
      kn: "ನುಗ್ಗೆಕಾಯಿ",
      ml: "മുരിങ്ങക്കായ",
      hi: "सहजन",
    },
    emoji: "🌿",
    defaultUnit: "kg",
    shelfLifeHours: 90,
    grading: {
      a: { en: "Straight, 45cm+, dark green, snaps clean" },
      b: { en: "Curved or 30cm+, still tender" },
      c: { en: "Fibrous, yellowing or short" },
    },
  },
  chilli: {
    id: "chilli",
    names: {
      en: "Green chilli",
      ta: "பச்சை மிளகாய்",
      te: "పచ్చిమిర్చి",
      kn: "ಹಸಿಮೆಣಸಿನಕಾಯಿ",
      ml: "പച്ചമുളക്",
      hi: "हरी मिर्च",
    },
    // Deliberately incomplete: this crop is called something else around
    // Kumbakonam, and the control page is where operations records that.
    regional: {
      Thanjavur: { ta: "பச்சை மிளகாய் (குண்டு)" },
    },
    emoji: "🌶️",
    defaultUnit: "kg",
    shelfLifeHours: 108,
    grading: {
      a: { en: "Uniform green, firm, 8cm+, stalk intact" },
      b: { en: "Mixed length, stalk intact, no shrivel" },
      c: { en: "Shrivelled tips or colour turning" },
    },
  },
  coconut: {
    id: "coconut",
    names: {
      en: "Coconut",
      ta: "தேங்காய்",
      hi: "नारियल",
    },
    emoji: "🥥",
    defaultUnit: "bag",
    shelfLifeHours: 720,
    grading: {
      a: { en: "Fully mature, heavy, husk intact, no cracks" },
      b: { en: "Mature, light husk damage" },
      c: { en: "Immature or cracked husk" },
    },
  },
};
