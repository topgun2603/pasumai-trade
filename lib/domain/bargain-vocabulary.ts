/**
 * What may be said in a bargain, and nothing else.
 *
 * Messages are chosen from a fixed list, never typed. That is a deliberate and
 * fairly severe restriction, and it buys three things that free text cannot:
 *
 *  - **The trade stays on the platform.** A phone number in a chat window is
 *    the deal moving to a call, where no price is recorded, no grading is
 *    witnessed and neither side has anything to point at when it goes wrong.
 *    The farmer carries that risk, not the buyer.
 *
 *  - **Both sides read it.** Every phrase exists in six languages. A farmer
 *    who reads only Tamil sees Tamil; the buyer who chose it saw English. Free
 *    text is whatever one party happened to type, and machine translation of a
 *    commercial term is a liability.
 *
 *  - **It cannot be abused.** There is no harassment, no pressure and no
 *    misrepresentation available in a list of thirty sentences about
 *    collection times.
 *
 * The cost is real: somebody will want to say a thing that is not here. The
 * answer is to add it to the list, where every party gets it in their own
 * language — not to open the box.
 */

export interface AllowedPhrase {
  readonly id: string;
  /** Per locale. `en` is guaranteed. */
  readonly text: Readonly<Record<string, string>>;
}

export type Speaker = "farmer" | "buyer" | "both";

export interface VocabularyEntry extends AllowedPhrase {
  /** Who may send it. A farmer does not say "we will collect tomorrow". */
  readonly speaker: Speaker;
}

/**
 * Everything either side can say.
 *
 * Deliberately about the trade and nothing else: quantity, quality, timing,
 * collection, payment. No greetings — a bargain is not a conversation — and
 * nothing that could carry a number somebody chose.
 */
export const BARGAIN_VOCABULARY: readonly VocabularyEntry[] = [
  /* Price ---------------------------------------------------------------- */
  {
    id: "price-too-low",
    speaker: "farmer",
    text: {
      en: "That price is too low for this quality.",
      ta: "இந்த தரத்திற்கு அந்த விலை மிகக் குறைவு.",
      te: "ఈ నాణ్యతకు ఆ ధర చాలా తక్కువ.",
      kn: "ಈ ಗುಣಮಟ್ಟಕ್ಕೆ ಆ ಬೆಲೆ ತುಂಬಾ ಕಡಿಮೆ.",
      ml: "ഈ ഗുണനിലവാരത്തിന് ആ വില വളരെ കുറവാണ്.",
      hi: "इस गुणवत्ता के लिए यह दाम बहुत कम है.",
    },
  },
  {
    id: "price-is-final",
    speaker: "farmer",
    text: {
      en: "This is my final price.",
      ta: "இதுவே எனது இறுதி விலை.",
      te: "ఇదే నా చివరి ధర.",
      kn: "ಇದೇ ನನ್ನ ಅಂತಿಮ ಬೆಲೆ.",
      ml: "ഇതാണ് എന്റെ അവസാന വില.",
      hi: "यही मेरा आखिरी दाम है.",
    },
  },
  {
    id: "price-can-improve",
    speaker: "buyer",
    text: {
      en: "I can improve the price if you can hold the lot for me.",
      ta: "இந்த மூட்டையை எனக்காக வைத்திருந்தால் விலையை உயர்த்த முடியும்.",
      te: "ఈ సరుకు నాకోసం ఉంచితే ధర పెంచగలను.",
      kn: "ಈ ಸರಕನ್ನು ನನಗಾಗಿ ಇಟ್ಟರೆ ಬೆಲೆ ಹೆಚ್ಚಿಸಬಲ್ಲೆ.",
      ml: "ഈ ചരക്ക് എനിക്കായി വെച്ചാൽ വില കൂട്ടാം.",
      hi: "अगर आप माल मेरे लिए रोक सकें तो दाम बढ़ा सकता हूँ.",
    },
  },

  /* Quantity ------------------------------------------------------------- */
  {
    id: "want-part-only",
    speaker: "buyer",
    text: {
      en: "I want only part of this lot, as offered.",
      ta: "இந்த மூட்டையில் ஒரு பகுதியை மட்டுமே நான் கேட்கிறேன்.",
      te: "ఈ సరుకులో కొంత భాగం మాత్రమే కావాలి.",
      kn: "ಈ ಸರಕಿನ ಒಂದು ಭಾಗ ಮಾತ್ರ ಬೇಕು.",
      ml: "ഈ ചരക്കിന്റെ ഒരു ഭാഗം മാത്രം മതി.",
      hi: "मुझे इस माल का केवल कुछ हिस्सा चाहिए.",
    },
  },
  {
    id: "want-whole-lot",
    speaker: "buyer",
    text: {
      en: "I will take the whole lot.",
      ta: "முழு மூட்டையையும் நான் எடுத்துக்கொள்கிறேன்.",
      te: "మొత్తం సరుకు తీసుకుంటాను.",
      kn: "ಪೂರ್ತಿ ಸರಕನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತೇನೆ.",
      ml: "മുഴുവൻ ചരക്കും ഞാൻ എടുക്കാം.",
      hi: "मैं पूरा माल ले लूँगा.",
    },
  },
  {
    id: "cannot-split",
    speaker: "farmer",
    text: {
      en: "I cannot split this lot — it goes together.",
      ta: "இந்த மூட்டையைப் பிரிக்க முடியாது — முழுவதுமாகவே செல்லும்.",
      te: "ఈ సరుకును విడగొట్టలేను — మొత్తం కలిపే వెళ్తుంది.",
      kn: "ಈ ಸರಕನ್ನು ವಿಭಜಿಸಲಾಗದು — ಒಟ್ಟಿಗೇ ಹೋಗುತ್ತದೆ.",
      ml: "ഈ ചരക്ക് വിഭജിക്കാനാവില്ല — ഒരുമിച്ചാണ് പോകുക.",
      hi: "यह माल बाँट नहीं सकता — पूरा एक साथ जाएगा.",
    },
  },
  {
    id: "can-split",
    speaker: "farmer",
    text: {
      en: "I can sell you part of it.",
      ta: "இதில் ஒரு பகுதியை உங்களுக்கு விற்க முடியும்.",
      te: "ఇందులో కొంత భాగం మీకు అమ్మగలను.",
      kn: "ಇದರಲ್ಲಿ ಒಂದು ಭಾಗವನ್ನು ನಿಮಗೆ ಮಾರಬಲ್ಲೆ.",
      ml: "ഇതിൽ ഒരു ഭാഗം നിങ്ങൾക്ക് വിൽക്കാം.",
      hi: "इसका कुछ हिस्सा आपको बेच सकता हूँ.",
    },
  },

  /* Quality -------------------------------------------------------------- */
  {
    id: "grading-at-pickup",
    speaker: "both",
    text: {
      en: "Grading happens at pickup, with both of us present.",
      ta: "தரப்பிரிப்பு எடுக்கும்போது, இருவரும் இருக்கும்போதே நடக்கும்.",
      te: "గ్రేడింగ్ తీసుకునేటప్పుడు, ఇద్దరం ఉండగానే జరుగుతుంది.",
      kn: "ಗ್ರೇಡಿಂಗ್ ಎತ್ತುವಾಗ, ಇಬ್ಬರೂ ಇರುವಾಗಲೇ ನಡೆಯುತ್ತದೆ.",
      ml: "ഗ്രേഡിംഗ് എടുക്കുമ്പോൾ, രണ്ടുപേരും ഉള്ളപ്പോൾ നടക്കും.",
      hi: "ग्रेडिंग उठाते समय, हम दोनों के सामने होगी.",
    },
  },
  {
    id: "quality-is-good",
    speaker: "farmer",
    text: {
      en: "The quality is as shown in the photographs.",
      ta: "தரம் புகைப்படங்களில் காட்டியபடியே உள்ளது.",
      te: "నాణ్యత ఫోటోలలో చూపినట్లే ఉంది.",
      kn: "ಗುಣಮಟ್ಟ ಫೋಟೋಗಳಲ್ಲಿ ತೋರಿಸಿದಂತೆಯೇ ಇದೆ.",
      ml: "ഗുണനിലവാരം ചിത്രങ്ങളിൽ കാണിച്ചതുപോലെയാണ്.",
      hi: "गुणवत्ता वैसी ही है जैसी तस्वीरों में है.",
    },
  },

  /* Timing and collection ------------------------------------------------ */
  {
    id: "collect-today",
    speaker: "buyer",
    text: {
      en: "We can collect today.",
      ta: "இன்றே எடுத்துச் செல்ல முடியும்.",
      te: "ఈ రోజే తీసుకెళ్లగలం.",
      kn: "ಇಂದೇ ತೆಗೆದುಕೊಂಡು ಹೋಗಬಹುದು.",
      ml: "ഇന്നുതന്നെ എടുക്കാൻ കഴിയും.",
      hi: "हम आज ही उठा सकते हैं.",
    },
  },
  {
    id: "collect-tomorrow",
    speaker: "buyer",
    text: {
      en: "We can collect tomorrow.",
      ta: "நாளை எடுத்துச் செல்ல முடியும்.",
      te: "రేపు తీసుకెళ్లగలం.",
      kn: "ನಾಳೆ ತೆಗೆದುಕೊಂಡು ಹೋಗಬಹುದು.",
      ml: "നാളെ എടുക്കാൻ കഴിയും.",
      hi: "हम कल उठा सकते हैं.",
    },
  },
  {
    id: "ready-now",
    speaker: "farmer",
    text: {
      en: "It is ready now.",
      ta: "இப்போதே தயாராக உள்ளது.",
      te: "ఇప్పుడే సిద్ధంగా ఉంది.",
      kn: "ಈಗಲೇ ಸಿದ್ಧವಾಗಿದೆ.",
      ml: "ഇപ്പോൾ തന്നെ തയ്യാറാണ്.",
      hi: "यह अभी तैयार है.",
    },
  },
  {
    id: "needs-two-days",
    speaker: "farmer",
    text: {
      en: "It will be ready in two or three days.",
      ta: "இரண்டு மூன்று நாட்களில் தயாராகிவிடும்.",
      te: "రెండు మూడు రోజుల్లో సిద్ధమవుతుంది.",
      kn: "ಎರಡು ಮೂರು ದಿನಗಳಲ್ಲಿ ಸಿದ್ಧವಾಗುತ್ತದೆ.",
      ml: "രണ്ടു മൂന്നു ദിവസത്തിനുള്ളിൽ തയ്യാറാകും.",
      hi: "दो-तीन दिन में तैयार हो जाएगा.",
    },
  },

  /* Closing -------------------------------------------------------------- */
  {
    id: "thinking-about-it",
    speaker: "both",
    text: {
      en: "Let me think about it.",
      ta: "யோசித்துச் சொல்கிறேன்.",
      te: "ఆలోచించి చెబుతాను.",
      kn: "ಯೋಚಿಸಿ ಹೇಳುತ್ತೇನೆ.",
      ml: "ആലോചിച്ചു പറയാം.",
      hi: "मैं सोचकर बताता हूँ.",
    },
  },
  {
    id: "not-interested",
    speaker: "both",
    text: {
      en: "This does not work for me.",
      ta: "இது எனக்குச் சரிவராது.",
      te: "ఇది నాకు సరిపడదు.",
      kn: "ಇದು ನನಗೆ ಸರಿಹೋಗದು.",
      ml: "ഇത് എനിക്ക് ശരിയാകില്ല.",
      hi: "यह मेरे लिए ठीक नहीं है.",
    },
  },
] as const;

/** Phrases this party is allowed to send. */
export function phrasesFor(speaker: "farmer" | "buyer"): VocabularyEntry[] {
  return BARGAIN_VOCABULARY.filter((p) => p.speaker === speaker || p.speaker === "both");
}

export function phraseById(id: string): VocabularyEntry | undefined {
  return BARGAIN_VOCABULARY.find((p) => p.id === id);
}

/**
 * May this party send this phrase?
 *
 * Checked on the server, against the id — never against the text. Comparing
 * text would mean trusting the client to have sent the phrase it claims, and a
 * body carrying `id: "collect-today", text: "call me on 98430 11204"` is
 * exactly the message this whole module exists to refuse.
 */
export function canSay(speaker: "farmer" | "buyer", phraseId: string): boolean {
  const phrase = phraseById(phraseId);
  if (!phrase) return false;
  return phrase.speaker === speaker || phrase.speaker === "both";
}

/** The phrase in a locale, falling back to English. */
export function say(phrase: AllowedPhrase, locale: string): string {
  return phrase.text[locale] ?? phrase.text.en;
}
