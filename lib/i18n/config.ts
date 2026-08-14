/**
 * Languages the platform speaks.
 *
 * Tamil first because that is where the platform operates today; the rest are
 * the languages of the states it grows into next, plus Hindi and English as
 * the two link languages.
 *
 * Each language is a separate **script**, not just a separate vocabulary, and
 * that has consequences the code has to respect:
 *
 *  - Every script needs its own font file. They are declared together but only
 *    the one actually rendering a glyph is downloaded, so a Tamil visitor
 *    never pays for Malayalam.
 *  - Indic scripts need more vertical space than Latin at the same size.
 *  - Sorting names requires the locale's collation, which is why comparisons
 *    pass a locale rather than relying on the default.
 */
export const LOCALES = ["en", "ta", "te", "kn", "ml", "hi"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export interface LocaleMeta {
  /** What the language calls itself. Never show a language in another one. */
  readonly nativeName: string;
  /** English name, for operator-facing tooling. */
  readonly englishName: string;
  /** Where it is mainly spoken. Helps someone pick from a list of six. */
  readonly region: string;
  /** BCP 47 tag used for `lang`, collation and number formatting. */
  readonly tag: string;
  /** CSS variable holding the font stack for this script. */
  readonly fontVariable: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    nativeName: "English",
    englishName: "English",
    region: "All India",
    tag: "en-IN",
    fontVariable: "--font-sans",
  },
  ta: {
    nativeName: "தமிழ்",
    englishName: "Tamil",
    region: "Tamil Nadu",
    tag: "ta-IN",
    fontVariable: "--font-tamil",
  },
  te: {
    nativeName: "తెలుగు",
    englishName: "Telugu",
    region: "Andhra Pradesh · Telangana",
    tag: "te-IN",
    fontVariable: "--font-telugu",
  },
  kn: {
    nativeName: "ಕನ್ನಡ",
    englishName: "Kannada",
    region: "Karnataka",
    tag: "kn-IN",
    fontVariable: "--font-kannada",
  },
  ml: {
    nativeName: "മലയാളം",
    englishName: "Malayalam",
    region: "Kerala",
    tag: "ml-IN",
    fontVariable: "--font-malayalam",
  },
  hi: {
    nativeName: "हिन्दी",
    englishName: "Hindi",
    region: "North India",
    tag: "hi-IN",
    fontVariable: "--font-devanagari",
  },
};

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * Best match for an `Accept-Language` header.
 *
 * Deliberately simple: match the primary subtag only. `ta-LK` (Sri Lankan
 * Tamil) should get Tamil, and a quality-weighted negotiation would be more
 * machinery than six languages justify.
 */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }

  return DEFAULT_LOCALE;
}

/** Cookie remembering an explicit choice. Beats the browser header. */
export const LOCALE_COOKIE = "pasumai_locale";
