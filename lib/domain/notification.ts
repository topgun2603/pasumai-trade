/**
 * What the platform tells somebody happened.
 *
 * A notification is **structured**, never a sentence. It carries a `kind` and
 * the few facts that go in the blanks, and the words are chosen at render time
 * from the reader's language — the same decision as the bargain vocabulary, for
 * the same reason: a farmer who reads only Tamil is not served by a row of
 * English written by whoever happened to trigger it.
 *
 * It is also a record of something that already happened, so nothing here
 * edits one. A notification is marked read and that is all; the event it
 * describes lives in the listing, the bargain or the order it points at.
 */

export const NOTIFICATION_KINDS = [
  /** A farmer posted produce a buyer covering that district can bid on. */
  "produceListed",
  /** A buyer opened a bargain on a lot. */
  "bargainOpened",
  /** The other side put new rates on the table. */
  "bargainCountered",
  /** The other side said something from the vocabulary. */
  "bargainMessage",
  /** Somebody accepted. Binding, and the reason to arrange a lorry. */
  "bargainAgreed",
  /** Somebody walked away, or it aged out. */
  "bargainClosed",
  /** An order was placed against agreed rates. */
  "orderPlaced",
  /** A farmer handed a settled lot to an agency. */
  "transportArranged",
  /** Operations approved a document. */
  "checkApproved",
  /** Operations refused one, with a reason. */
  "checkRejected",
  /** Operations asked a question and are waiting on an answer. */
  "checkNeedsInfo",
  /** The document was unreadable; send it again. */
  "checkNeedsReupload",
  /** Every check passed. The account can trade. */
  "accountVerified",
  /** A subscription is running out, or has. */
  "subscriptionEnding",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Who a notification is for. Only the two sides of a trade get them. */
export type NotificationAudience = "farmer" | "buyer";

/**
 * The facts that fill the blanks.
 *
 * Denormalised on purpose. A notification has to render years later without
 * reading the listing it refers to — the listing may be gone, and a row saying
 * "your produce sold" with no crop name is not a record of anything.
 */
export interface NotificationSubject {
  readonly produceName?: string;
  /** In `unit`. What the event was about, not what the lot holds. */
  readonly quantity?: number;
  readonly unit?: string;
  /** The other side, by name. Never an account id — this is read by a person. */
  readonly counterparty?: string;
  readonly listingId?: string;
  readonly negotiationId?: string;
  readonly orderId?: string;
  readonly agencyName?: string;
  /**
   * What operations actually said, in their own words.
   *
   * Free text, so it is shown beside the templated sentence rather than
   * inside it — a question typed in English does not belong in the middle of a
   * Tamil sentence, and the sentence is what gets translated.
   *
   * Without this the applicant was told "we need something more about
   * Identity" and never what. The question was stored on the check and shown
   * nowhere.
   */
  readonly note?: string;
}

export interface Notification {
  readonly id: string;
  /** The account this belongs to. Every read is scoped by it. */
  readonly accountId: string;
  readonly audience: NotificationAudience;
  readonly kind: NotificationKind;
  readonly subject: NotificationSubject;
  /** Where tapping it goes. Resolved when written, so old rows still navigate. */
  readonly href: string;
  readonly createdAt: Date;
  /** Set once, when the person has seen it. */
  readonly readAt?: Date;
}

/* -------------------------------------------------------------------------
   Words
   ------------------------------------------------------------------------- */

/**
 * One line per kind, per language.
 *
 * `{produce}`, `{amount}`, `{who}` and `{agency}` are filled from the subject.
 * Six languages because the consoles are read by people who do not share one,
 * and a notification nobody can read is a notification that did not happen.
 */
type Copy = Readonly<Record<string, string>>;

/**
 * The quantity, with whatever joins it to the crop.
 *
 * One placeholder rather than two, because the connector belongs to the
 * quantity and not to the sentence: English says "400 kg **of** tomato" and
 * Tamil says neither. Splitting them left "an order for of Onion" the moment a
 * quantity was missing — the connector survived the fact it connected.
 *
 * Renders empty when there is no quantity, taking its connector with it.
 */
const AMOUNT: Copy = {
  en: "{quantity} {unit} of ",
  ta: "{quantity} {unit} ",
  te: "{quantity} {unit} ",
  kn: "{quantity} {unit} ",
  ml: "{quantity} {unit} ",
  hi: "{quantity} {unit} ",
};

export const NOTIFICATION_COPY: Record<NotificationKind, Copy> = {
  produceListed: {
    en: "{who} listed {amount}{produce}.",
    ta: "{who} {amount}{produce} பட்டியலிட்டுள்ளார்.",
    te: "{who} {amount}{produce} జాబితా చేశారు.",
    kn: "{who} {amount}{produce} ಪಟ್ಟಿ ಮಾಡಿದ್ದಾರೆ.",
    ml: "{who} {amount}{produce} ലിസ്റ്റ് ചെയ്തു.",
    hi: "{who} ने {amount}{produce} सूचीबद्ध किया।",
  },
  bargainOpened: {
    en: "{who} opened a bargain on your {produce}.",
    ta: "உங்கள் {produce} மீது {who} பேரம் தொடங்கியுள்ளார்.",
    te: "మీ {produce} పై {who} బేరం మొదలుపెట్టారు.",
    kn: "ನಿಮ್ಮ {produce} ಮೇಲೆ {who} ಚೌಕಾಸಿ ಆರಂಭಿಸಿದ್ದಾರೆ.",
    ml: "നിങ്ങളുടെ {produce} യിൽ {who} വിലപേശൽ തുടങ്ങി.",
    hi: "{who} ने आपके {produce} पर मोल-भाव शुरू किया।",
  },
  bargainCountered: {
    en: "{who} sent new rates for {produce}.",
    ta: "{produce}க்கு {who} புதிய விலை அனுப்பியுள்ளார்.",
    te: "{produce} కోసం {who} కొత్త ధరలు పంపారు.",
    kn: "{produce} ಗಾಗಿ {who} ಹೊಸ ದರ ಕಳುಹಿಸಿದ್ದಾರೆ.",
    ml: "{produce} യ്ക്ക് {who} പുതിയ നിരക്ക് അയച്ചു.",
    hi: "{who} ने {produce} के लिए नए दाम भेजे।",
  },
  bargainMessage: {
    en: "{who} sent a message about {produce}.",
    ta: "{produce} குறித்து {who} செய்தி அனுப்பியுள்ளார்.",
    te: "{produce} గురించి {who} సందేశం పంపారు.",
    kn: "{produce} ಕುರಿತು {who} ಸಂದೇಶ ಕಳುಹಿಸಿದ್ದಾರೆ.",
    ml: "{produce} കുറിച്ച് {who} സന്ദേശം അയച്ചു.",
    hi: "{who} ने {produce} के बारे में संदेश भेजा।",
  },
  bargainAgreed: {
    en: "Price agreed with {who} for {amount}{produce}.",
    ta: "{amount}{produce}க்கு {who} உடன் விலை முடிவானது.",
    te: "{amount}{produce} కు {who} తో ధర కుదిరింది.",
    kn: "{amount}{produce} ಗೆ {who} ಜೊತೆ ಬೆಲೆ ನಿಗದಿಯಾಗಿದೆ.",
    ml: "{amount}{produce} യ്ക്ക് {who} മായി വില ഉറപ്പിച്ചു.",
    hi: "{amount}{produce} के लिए {who} के साथ दाम तय हुआ।",
  },
  bargainClosed: {
    en: "The bargain with {who} for {produce} is closed.",
    ta: "{produce}க்கான {who} உடனான பேரம் முடிந்தது.",
    te: "{produce} కోసం {who} తో బేరం ముగిసింది.",
    kn: "{produce} ಗಾಗಿ {who} ಜೊತೆಗಿನ ಚೌಕಾಸಿ ಮುಗಿದಿದೆ.",
    ml: "{produce} യ്ക്കുള്ള {who} മായുള്ള വിലപേശൽ അവസാനിച്ചു.",
    hi: "{produce} के लिए {who} के साथ मोल-भाव समाप्त हुआ।",
  },
  orderPlaced: {
    en: "{who} placed an order for {amount}{produce}.",
    ta: "{amount}{produce}க்கு {who} ஆர்டர் செய்துள்ளார்.",
    te: "{amount}{produce} కు {who} ఆర్డర్ ఇచ్చారు.",
    kn: "{amount}{produce} ಗೆ {who} ಆರ್ಡರ್ ಮಾಡಿದ್ದಾರೆ.",
    ml: "{amount}{produce} യ്ക്ക് {who} ഓർഡർ നൽകി.",
    hi: "{who} ने {amount}{produce} का ऑर्डर दिया।",
  },
  checkApproved: {
    en: "{who} was approved.",
    ta: "{who} அங்கீகரிக்கப்பட்டது.",
    te: "{who} ఆమోదించబడింది.",
    kn: "{who} ಅನುಮೋದಿಸಲಾಗಿದೆ.",
    ml: "{who} അംഗീകരിച്ചു.",
    hi: "{who} स्वीकृत हुआ।",
  },
  checkRejected: {
    en: "{who} was not accepted. Open verification to see why.",
    ta: "{who} ஏற்கப்படவில்லை. காரணத்தைப் பார்க்க சரிபார்ப்பைத் திறக்கவும்.",
    te: "{who} ఆమోదించలేదు. కారణం చూడటానికి ధృవీకరణ తెరవండి.",
    kn: "{who} ಸ್ವೀಕರಿಸಿಲ್ಲ. ಕಾರಣ ನೋಡಲು ಪರಿಶೀಲನೆ ತೆರೆಯಿರಿ.",
    ml: "{who} സ്വീകരിച്ചില്ല. കാരണം കാണാൻ പരിശോധന തുറക്കുക.",
    hi: "{who} स्वीकार नहीं हुआ। कारण देखने के लिए सत्यापन खोलें।",
  },
  checkNeedsInfo: {
    en: "We need something more about {who}.",
    ta: "{who} குறித்து மேலும் விவரம் தேவை.",
    te: "{who} గురించి మరింత సమాచారం కావాలి.",
    kn: "{who} ಕುರಿತು ಇನ್ನಷ್ಟು ಮಾಹಿತಿ ಬೇಕು.",
    ml: "{who} സംബന്ധിച്ച് കൂടുതൽ വിവരം വേണം.",
    hi: "{who} के बारे में कुछ और चाहिए।",
  },
  checkNeedsReupload: {
    en: "{who} could not be read. Please send it again.",
    ta: "{who} படிக்க முடியவில்லை. மீண்டும் அனுப்பவும்.",
    te: "{who} చదవలేకపోయాము. మళ్లీ పంపండి.",
    kn: "{who} ಓದಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಕಳುಹಿಸಿ.",
    ml: "{who} വായിക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും അയയ്ക്കുക.",
    hi: "{who} पढ़ा नहीं जा सका। कृपया दोबारा भेजें।",
  },
  accountVerified: {
    en: "Your account is verified. You can trade now.",
    ta: "உங்கள் கணக்கு சரிபார்க்கப்பட்டது. இப்போது வர்த்தகம் செய்யலாம்.",
    te: "మీ ఖాతా ధృవీకరించబడింది. ఇప్పుడు వ్యాపారం చేయవచ్చు.",
    kn: "ನಿಮ್ಮ ಖಾತೆ ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ಈಗ ವ್ಯಾಪಾರ ಮಾಡಬಹುದು.",
    ml: "നിങ്ങളുടെ അക്കൗണ്ട് പരിശോധിച്ചു. ഇനി വ്യാപാരം ചെയ്യാം.",
    hi: "आपका खाता सत्यापित है। अब आप व्यापार कर सकते हैं।",
  },
  subscriptionEnding: {
    en: "Your plan is ending. Renew to keep trading.",
    ta: "உங்கள் திட்டம் முடிவடைகிறது. தொடர புதுப்பிக்கவும்.",
    te: "మీ ప్లాన్ ముగుస్తోంది. కొనసాగించడానికి పునరుద్ధరించండి.",
    kn: "ನಿಮ್ಮ ಯೋಜನೆ ಮುಗಿಯುತ್ತಿದೆ. ಮುಂದುವರಿಸಲು ನವೀಕರಿಸಿ.",
    ml: "നിങ്ങളുടെ പ്ലാൻ അവസാനിക്കുന്നു. തുടരാൻ പുതുക്കുക.",
    hi: "आपकी योजना समाप्त हो रही है। जारी रखने के लिए नवीनीकरण करें।",
  },
  transportArranged: {
    en: "{agency} is collecting {amount}{produce}.",
    ta: "{amount}{produce} ஐ {agency} எடுத்துச் செல்கிறது.",
    te: "{amount}{produce} ను {agency} తీసుకెళ్తోంది.",
    kn: "{amount}{produce} ಅನ್ನು {agency} ತೆಗೆದುಕೊಂಡು ಹೋಗುತ್ತಿದೆ.",
    ml: "{amount}{produce} {agency} എടുക്കുന്നു.",
    hi: "{agency} {amount}{produce} उठा रहा है।",
  },
};

/**
 * Stand-ins for a fact the writer did not have.
 *
 * A quantity can simply vanish from a sentence — "sold 400 kg of" and "sold of"
 * both collapse cleanly once the blanks are squeezed. A **noun** cannot: it
 * sits behind a preposition, and dropping it leaves "the bargain with Kongu
 * Agri for is closed", which reads as a bug because it is one. So the nouns get
 * a word and the numbers get nothing.
 */
const FALLBACKS: Record<"produce" | "who" | "agency", Copy> = {
  produce: {
    en: "your produce",
    ta: "உங்கள் விளைபொருள்",
    te: "మీ పంట",
    kn: "ನಿಮ್ಮ ಬೆಳೆ",
    ml: "നിങ്ങളുടെ വിള",
    hi: "आपकी उपज",
  },
  who: {
    en: "Someone",
    ta: "ஒருவர்",
    te: "ఎవరో",
    kn: "ಯಾರೋ",
    ml: "ആരോ",
    hi: "किसी ने",
  },
  agency: {
    en: "An agency",
    ta: "ஒரு நிறுவனம்",
    te: "ఒక ఏజెన్సీ",
    kn: "ಒಂದು ಏಜೆನ್ಸಿ",
    ml: "ഒരു ഏജൻസി",
    hi: "एक एजेंसी",
  },
};

/**
 * The line, in the reader's language.
 *
 * A notification whose listing has since been deleted is degraded, not broken:
 * it still says who did what, with a stand-in where the name should be. Falls
 * back to English, which every entry above is guaranteed to have.
 */
export function describe(notification: Notification, locale: string): string {
  const copy = NOTIFICATION_COPY[notification.kind];
  const template = copy[locale] ?? copy.en ?? "";
  const { produceName, quantity, unit, counterparty, agencyName } = notification.subject;

  // `?? ""` on the English too. Every entry above has it, but the copy tables
  // are indexed by an arbitrary locale string, and the functions package
  // compiles this file with `noUncheckedIndexedAccess` — where "guaranteed by
  // a test" is not the same as "guaranteed by the type".
  const stand = (key: keyof typeof FALLBACKS) =>
    FALLBACKS[key][locale] ?? FALLBACKS[key].en ?? "";

  // Numbers get no stand-in — "some kg" would be the platform inventing a
  // figure. The whole amount phrase drops instead, connector and all.
  const amount =
    quantity === undefined
      ? ""
      : (AMOUNT[locale] ?? AMOUNT.en ?? "")
          .replace("{quantity}", String(quantity))
          .replace("{unit}", unit ?? "")
          .replace(/\s{2,}/g, " ");

  const values: Record<string, string> = {
    amount,
    produce: produceName ?? stand("produce"),
    who: counterparty ?? stand("who"),
    agency: agencyName ?? stand("agency"),
  };

  return (
    template
      .replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
      // Squeeze the gap a dropped number leaves, so a half-known row reads as a
      // sentence rather than as a form with holes in it.
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.।])/g, "$1")
      .trim()
  );
}

/* -------------------------------------------------------------------------
   Reading a list of them
   ------------------------------------------------------------------------- */

export function isUnread(notification: Notification): boolean {
  return notification.readAt === undefined;
}

export function unreadCount(notifications: readonly Notification[]): number {
  return notifications.filter(isUnread).length;
}

/**
 * Newest first, unread never buried.
 *
 * Sorted by time alone, a fortnight-old unread notification sits below
 * everything read this morning — which is exactly the one that still needs
 * doing. Unread float, and within each group the newest leads.
 */
export function inReadingOrder(
  notifications: readonly Notification[],
): Notification[] {
  return [...notifications].sort(
    (a, b) =>
      Number(isUnread(b)) - Number(isUnread(a)) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/**
 * Which kinds a reader can filter to.
 *
 * Grouped by what somebody is looking for rather than by what wrote them: "did
 * anything sell" is one question, "is anybody bargaining" is another.
 */
export const NOTIFICATION_GROUPS = {
  verification: [
    "checkApproved",
    "checkRejected",
    "checkNeedsInfo",
    "checkNeedsReupload",
    "accountVerified",
  ],
  bargaining: ["bargainOpened", "bargainCountered", "bargainMessage"],
  settled: ["bargainAgreed", "bargainClosed", "orderPlaced"],
  produce: ["produceListed"],
  transport: ["transportArranged"],
  // Its own group rather than folded into verification: a renewal reminder is
  // about money and a deadline, and somebody muting "verification" should not
  // thereby stop hearing that their access is about to stop.
  billing: ["subscriptionEnding"],
} as const satisfies Record<string, readonly NotificationKind[]>;

export type NotificationGroup = keyof typeof NOTIFICATION_GROUPS;

export function groupOf(kind: NotificationKind): NotificationGroup {
  for (const [group, kinds] of Object.entries(NOTIFICATION_GROUPS)) {
    if ((kinds as readonly string[]).includes(kind)) return group as NotificationGroup;
  }
  // Unreachable while the map covers every kind, and the tests hold it to that.
  return "bargaining";
}
