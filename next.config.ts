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
};

export default nextConfig;
