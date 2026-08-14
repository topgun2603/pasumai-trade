import type { DocumentKind } from "@/lib/domain/admin";

/**
 * Reference data the Controls page maintains, in its starting state.
 *
 * Seeded so the platform boots with sane values rather than with empty
 * dropdowns, and so a machine with no Firebase credentials still renders
 * something honest.
 *
 * Translations here need review by a native speaker before release — the same
 * caveat that stands on the crop catalogue. They are close enough to build
 * against and not close enough to send.
 */

/* -------------------------------------------------------------------------
   Packs
   ------------------------------------------------------------------------- */

export interface Pack {
  readonly id: string;
  readonly unit: string;
  readonly container: string;
  readonly packSize: number;
  /** Derived from the three above, never typed by hand. */
  readonly label: string;
  readonly active: boolean;
}

function pack(unit: string, container: string, packSize: number): Pack {
  const label = `${packSize} ${unit} ${container.toLowerCase()}`;
  return {
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    unit,
    container,
    packSize,
    label,
    active: true,
  };
}

export const PACKS: Pack[] = [
  pack("kg", "Crate", 25),
  pack("kg", "Crate", 20),
  pack("kg", "Crate", 10),
  pack("kg", "Box", 20),
  pack("kg", "Bag", 10),
  pack("kg", "Bundle", 10),
  pack("bag", "Bag", 1),
  pack("quintal", "Sack", 1),
];

/* -------------------------------------------------------------------------
   Phrases
   ------------------------------------------------------------------------- */

export interface Phrase {
  readonly id: string;
  readonly kind: "notification" | "quickReply";
  readonly event: string | null;
  readonly channel: string | null;
  readonly audience: "farmer" | "buyer" | "driver";
  readonly text: Readonly<Record<string, string>>;
  readonly active: boolean;
}

export const PHRASES: Phrase[] = [
  /* What the platform sends ---------------------------------------------- */
  {
    id: "quote-received",
    kind: "notification",
    event: "quoteReceived",
    channel: "sms",
    audience: "farmer",
    text: {
      en: "A buyer has quoted a price for your {crop}. Open the app to see it.",
      ta: "உங்கள் {crop} விலைக்கு ஒரு வாங்குபவர் விலை சொல்லியுள்ளார். செயலியில் பாருங்கள்.",
      te: "మీ {crop}కి ఒక కొనుగోలుదారు ధర చెప్పారు. యాప్‌లో చూడండి.",
      kn: "ನಿಮ್ಮ {crop} ಗೆ ಖರೀದಿದಾರರು ಬೆಲೆ ನೀಡಿದ್ದಾರೆ. ಆ್ಯಪ್‌ನಲ್ಲಿ ನೋಡಿ.",
      ml: "നിങ്ങളുടെ {crop}ന് ഒരു വാങ്ങുന്നയാൾ വില പറഞ്ഞു. ആപ്പിൽ കാണുക.",
      hi: "आपकी {crop} के लिए एक खरीदार ने भाव दिया है। ऐप में देखें।",
    },
    active: true,
  },
  {
    id: "price-agreed",
    kind: "notification",
    event: "priceAgreed",
    channel: "sms",
    audience: "farmer",
    text: {
      en: "Price agreed for your {crop}. Grade A {rate}. Keep the stock ready.",
      ta: "உங்கள் {crop} விலை முடிவானது. தரம் A {rate}. சரக்கை தயாராக வையுங்கள்.",
      te: "మీ {crop} ధర ఖరారైంది. గ్రేడ్ A {rate}. సరుకు సిద్ధంగా ఉంచండి.",
      kn: "ನಿಮ್ಮ {crop} ಬೆಲೆ ನಿಗದಿಯಾಗಿದೆ. ಗ್ರೇಡ್ A {rate}. ಸರಕು ಸಿದ್ಧವಾಗಿಡಿ.",
      ml: "നിങ്ങളുടെ {crop} വില ഉറപ്പിച്ചു. ഗ്രേഡ് A {rate}. ചരക്ക് തയ്യാറാക്കി വയ്ക്കുക.",
      hi: "आपकी {crop} का भाव तय हो गया। ग्रेड A {rate}. माल तैयार रखें।",
    },
    active: true,
  },
  {
    id: "vehicle-dispatched",
    kind: "notification",
    event: "vehicleDispatched",
    channel: "sms",
    audience: "farmer",
    text: {
      en: "Vehicle {registration} is on the way. Driver {driver}. Expected {time}.",
      ta: "வாகனம் {registration} வந்து கொண்டிருக்கிறது. ஓட்டுநர் {driver}. {time} மணிக்கு வரும்.",
      te: "వాహనం {registration} వస్తోంది. డ్రైవర్ {driver}. {time}కి వస్తుంది.",
      kn: "ವಾಹನ {registration} ಬರುತ್ತಿದೆ. ಚಾಲಕ {driver}. {time} ಕ್ಕೆ ಬರುತ್ತದೆ.",
      ml: "വാഹനം {registration} വരുന്നു. ഡ്രൈവർ {driver}. {time}ന് എത്തും.",
      hi: "गाड़ी {registration} आ रही है। ड्राइवर {driver}. {time} तक पहुँचेगी।",
    },
    active: true,
  },
  {
    id: "handover-code",
    kind: "notification",
    event: "handoverCode",
    channel: "sms",
    audience: "farmer",
    text: {
      en: "Your handover code is {code}. Give it to the driver only after weighing.",
      ta: "உங்கள் ஒப்படைப்பு எண் {code}. நிறுத்த பிறகுதான் ஓட்டுநரிடம் சொல்லுங்கள்.",
      te: "మీ హ్యాండోవర్ కోడ్ {code}. తూకం అయ్యాకే డ్రైవర్‌కు చెప్పండి.",
      kn: "ನಿಮ್ಮ ಹಸ್ತಾಂತರ ಸಂಕೇತ {code}. ತೂಕ ಮಾಡಿದ ನಂತರವೇ ಚಾಲಕರಿಗೆ ತಿಳಿಸಿ.",
      ml: "നിങ്ങളുടെ കൈമാറ്റ കോഡ് {code}. തൂക്കിയ ശേഷം മാത്രം ഡ്രൈവർക്ക് നൽകുക.",
      hi: "आपका हैंडओवर कोड {code} है। तौल के बाद ही ड्राइवर को बताएं।",
    },
    active: true,
  },
  {
    id: "payment-settled",
    kind: "notification",
    event: "paymentSettled",
    channel: "sms",
    audience: "farmer",
    text: {
      en: "{amount} has been paid into your account ending {tail}.",
      ta: "{amount} உங்கள் {tail} கணக்கில் செலுத்தப்பட்டது.",
      te: "{amount} మీ {tail} ఖాతాలో జమ అయింది.",
      kn: "{amount} ನಿಮ್ಮ {tail} ಖಾತೆಗೆ ಜಮಾ ಆಗಿದೆ.",
      ml: "{amount} നിങ്ങളുടെ {tail} അക്കൗണ്ടിൽ അടച്ചു.",
      hi: "{amount} आपके {tail} खाते में जमा हो गया है।",
    },
    active: true,
  },

  /* What a farmer can tap instead of typing ------------------------------ */
  {
    id: "reply-picked-today",
    kind: "quickReply",
    event: null,
    channel: null,
    audience: "farmer",
    text: {
      en: "Picked this morning",
      ta: "இன்று காலை பறித்தது",
      te: "ఈ ఉదయం కోసినది",
      kn: "ಇಂದು ಬೆಳಿಗ್ಗೆ ಕೊಯ್ದದ್ದು",
      ml: "ഇന്ന് രാവിലെ പറിച്ചത്",
      hi: "आज सुबह तोड़ा गया",
    },
    active: true,
  },
  {
    id: "reply-ready-to-load",
    kind: "quickReply",
    event: null,
    channel: null,
    audience: "farmer",
    text: {
      en: "Ready to load today",
      ta: "இன்றே ஏற்ற தயார்",
      te: "ఈరోజే లోడ్ చేయడానికి సిద్ధం",
      kn: "ಇಂದೇ ಲೋಡ್ ಮಾಡಲು ಸಿದ್ಧ",
      ml: "ഇന്ന് തന്നെ കയറ്റാൻ തയ്യാർ",
      hi: "आज ही लोड करने को तैयार",
    },
    active: true,
  },
  {
    id: "reply-can-you-do-better",
    kind: "quickReply",
    event: null,
    channel: null,
    audience: "farmer",
    text: {
      en: "Can you do better?",
      ta: "இன்னும் கொஞ்சம் கூட்ட முடியுமா?",
      te: "కొంచెం ఎక్కువ ఇవ్వగలరా?",
      kn: "ಸ್ವಲ್ಪ ಹೆಚ್ಚು ಕೊಡಲು ಸಾಧ್ಯವೇ?",
      ml: "കുറച്ചു കൂടി കൂട്ടാമോ?",
      hi: "थोड़ा और बढ़ा सकते हैं?",
    },
    active: true,
  },
  {
    id: "reply-too-low",
    kind: "quickReply",
    event: null,
    channel: null,
    audience: "farmer",
    text: {
      en: "That is too low",
      ta: "இது ரொம்ப குறைவு",
      te: "ఇది చాలా తక్కువ",
      kn: "ಇದು ತುಂಬಾ ಕಡಿಮೆ",
      ml: "ഇത് വളരെ കുറവാണ്",
      hi: "यह बहुत कम है",
    },
    active: true,
  },
];

/* -------------------------------------------------------------------------
   Document rules
   ------------------------------------------------------------------------- */

export interface DocumentRule {
  readonly id: string;
  readonly stateId: string;
  readonly subject: "farmer" | "buyer" | "driver" | "vehicle";
  readonly required: readonly DocumentKind[];
  readonly active: boolean;
}

function rule(
  stateId: string,
  subject: DocumentRule["subject"],
  required: DocumentKind[],
): DocumentRule {
  return { id: `${stateId}-${subject}`, stateId, subject, required, active: true };
}

/**
 * Tamil Nadu only, because that is where the platform operates.
 *
 * The other states deliberately have no rules yet rather than a copy of these
 * — an unreviewed copy would read as a compliance decision somebody made, and
 * nobody has.
 */
export const DOCUMENT_RULES: DocumentRule[] = [
  rule("tn", "farmer", ["aadhaar", "bankProof"]),
  rule("tn", "buyer", ["pan", "gst", "bankProof", "fssai"]),
  rule("tn", "driver", ["aadhaar", "drivingLicence"]),
  rule("tn", "vehicle", ["rc", "insurance", "fitness", "permit"]),
];
