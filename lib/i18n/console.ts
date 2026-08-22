import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getDictionary, type Dictionary } from "./index";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * What language a console should be in.
 *
 * The public site carries the locale in the path — `/ta/pricing` — and the
 * consoles never could: they sit outside `[locale]` because they are one app
 * per role rather than one page per language, and moving them under it would
 * rewrite every internal link on the platform to gain a prefix nobody reads.
 *
 * So the choice comes from the cookie the language switcher already sets. A
 * farmer who reads the site in Tamil, signs in, and lands on `/farm` keeps
 * Tamil, because the same cookie followed them across the boundary.
 *
 * ## Why not the account record
 *
 * It would follow them to a second handset, which the cookie does not. But it
 * costs a read on every console page to answer a question the browser already
 * knows, and a farmer who has just switched language should see the change on
 * the next click rather than after a write lands in Oregon. The cookie wins on
 * both; storing it on the account as well is worth doing the day somebody
 * actually signs in from two devices and complains.
 */

export const consoleLocale = cache(async function consoleLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  return chosen && isLocale(chosen) ? chosen : DEFAULT_LOCALE;
});

/** The dictionary for whatever language this console is being read in. */
export async function consoleDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await consoleLocale();
  return { locale, t: getDictionary(locale) };
}
