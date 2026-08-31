import "server-only";

/**
 * The platform's own address, for links that leave the browser.
 *
 * Every link inside the app is relative and needs none of this. An SMS does:
 * `/farm/subscription` in a text message is not a link at all.
 *
 * Ordered by how much each source can be trusted to be the address a farmer
 * should actually receive. `NEXT_PUBLIC_SITE_URL` is the one somebody chose;
 * `VERCEL_PROJECT_PRODUCTION_URL` is the production domain even when the code
 * is running in a preview, which is what we want — a preview deployment must
 * not text people a link to itself. `VERCEL_URL` is the last resort and is
 * per-deployment.
 *
 * ## The localhost fallback is more dangerous than it looks
 *
 * This is not only used for SMS links. `metadataBase` on the locale layout,
 * `app/sitemap.ts` and `app/robots.ts` all call it, so whatever comes back
 * becomes the canonical URL of every page, every `<loc>` in the sitemap, and
 * the og:image and twitter:image addresses.
 *
 * Reaching the last line in production therefore tells search engines that the
 * real site is a duplicate of `http://localhost:3000` — a page they cannot
 * fetch — and points every social preview at a machine not on the internet.
 * Nothing errors. The site renders correctly and simply does not get indexed.
 *
 * It has happened: none of the `VERCEL_*` variables exist unless the project
 * has "Automatically expose System Environment Variables" switched on, so a
 * deployment with that off and `NEXT_PUBLIC_SITE_URL` unset falls all the way
 * through. Set the variable explicitly; see `.env.example`.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}
