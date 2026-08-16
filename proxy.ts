import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  matchLocale,
} from "@/lib/i18n/config";

/**
 * Two redirects, and nothing else.
 *
 * Proxy — Middleware's name since Next 16 — is the correct place for this and
 * *only* this. The docs are explicit that it is not a session or authorisation
 * layer, so it does no auth work: it redirects, and that is all.
 *
 *  - a bare `/` goes to the right language;
 *  - `/market` goes to `/listings`, because the market is withdrawn.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
    The market was a catalogue of stock already bought and graded, and nothing
    feeds it yet — so it is withdrawn until the pipeline from an agreed bargain
    through grading exists.

    Redirected here rather than from the page itself. `redirect()` inside a
    route whose layout has already begun streaming cannot send a 307, so Next
    falls back to a meta refresh — a visible second of blank page. This answers
    before any of that starts, and before the layout does its session work for
    a page nobody is going to see.
  */
  if (pathname === "/market" || pathname.startsWith("/market/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/listings";
    return NextResponse.redirect(url);
  }

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
  // The site root and the withdrawn market. Every other console route, API
  // route and asset goes straight past.
  matcher: ["/", "/market/:path*"],
};
