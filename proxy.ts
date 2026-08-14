import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  matchLocale,
} from "@/lib/i18n/config";

/**
 * Sends a bare `/` to the right language.
 *
 * Proxy — Middleware's name since Next 16 — is the correct place for this and
 * *only* this. The docs are explicit that it is not a session or authorisation
 * layer, so it does no auth work: it redirects, and nothing else.
 *
 * Order of preference: an explicit choice remembered in a cookie, then the
 * browser's `Accept-Language`, then English.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname !== "/") return NextResponse.next();

  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen)
    ? chosen
    : matchLocale(request.headers.get("accept-language")) || DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Only the site root. Console routes, API routes and assets never reach it.
  matcher: "/",
};
