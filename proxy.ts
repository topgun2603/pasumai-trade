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

  /*
    This redirect is not one answer, it is six.

    It is computed from a cookie and an `Accept-Language` header, so a CDN that
    caches the first response and replays it would send every later visitor
    wherever the first one happened to be going — a Tamil reader to `/hi`
    because somebody in Delhi arrived first. `Vary` is what stops that.

    It stays a 307 rather than a 308. A permanent redirect would let a browser
    cache `/` → `/ta` forever, and the language a person wants is not a property
    of the URL — they may change it on the next visit, and the cookie above is
    what should decide.
  */
  const response = NextResponse.redirect(url);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // The site root and the withdrawn market. Every other console route, API
  // route and asset goes straight past.
  matcher: ["/", "/market/:path*"],
};
