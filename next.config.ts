import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep the Admin SDK out of the bundler entirely.
   *
   * `firebase-admin` reaches `jwks-rsa`, which is CommonJS and depends on
   * `jose@6`, which is ESM-only. Node can `require()` an ES module these days,
   * but Turbopack's own external-module shim loads it through a path that does
   * not get that interop — so on Vercel every route touching the Admin SDK
   * died with `ERR_REQUIRE_ESM`, while `next start` locally was fine.
   *
   * Listing it here means Node resolves it natively at runtime, which is what
   * a package with a mixed CJS/ESM dependency tree needs.
   */
  serverExternalPackages: ["firebase-admin"],

  /**
   * Where the account pages used to live.
   *
   * Verification and Subscription moved under each console's Profile area, and
   * the farm console is an installed PWA — people have home-screen shortcuts
   * and bookmarks to the old addresses. Without these, the day this ships is
   * the day those shortcuts start returning a 404, and nobody would report it
   * as a deployment problem because the app itself works.
   *
   * Permanent, because the pages are not coming back. Kept as a list rather
   * than dropped after a release: a shortcut on somebody's phone outlives any
   * grace period we might pick.
   */
  async redirects() {
    return [
      { source: "/verification", destination: "/account/verification", permanent: true },
      { source: "/subscription", destination: "/account/subscription", permanent: true },
      {
        source: "/farm/verification",
        destination: "/farm/account/verification",
        permanent: true,
      },
      {
        source: "/farm/subscription",
        destination: "/farm/account/subscription",
        permanent: true,
      },
      {
        source: "/agency/verification",
        destination: "/agency/profile/verification",
        permanent: true,
      },
      {
        source: "/agency/subscription",
        destination: "/agency/profile/subscription",
        permanent: true,
      },
      /*
        The price chart moved inside History. It was a rail item, so it is in
        somebody's history and quite possibly bookmarked — and on an installed
        console a 404 here looks like the app breaking rather than a page
        moving.
      */
      {
        source: "/farm/analytics",
        destination: "/farm/account/history",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
