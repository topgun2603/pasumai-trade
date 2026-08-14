import { DEFAULT_LOCALE, type Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { hi } from "./dictionaries/hi";
import { kn } from "./dictionaries/kn";
import { ml } from "./dictionaries/ml";
import { ta } from "./dictionaries/ta";
import { te } from "./dictionaries/te";

/**
 * Dictionaries are imported statically rather than lazily.
 *
 * Six languages of marketing copy is a few tens of kilobytes, and the pages
 * that use them are prerendered per locale at build time — so each generated
 * page only ever carries its own strings. A dynamic import here would buy
 * nothing and would stop the pages being static.
 */
const DICTIONARIES: Record<Locale, Dictionary> = { en, ta, te, kn, ml, hi };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Fills `{name}` placeholders.
 *
 * Deliberately tiny. Anything needing plural rules or gendered agreement
 * should use `Intl.PluralRules` at the call site rather than growing this into
 * a template language.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Dictionary };
export * from "./config";
