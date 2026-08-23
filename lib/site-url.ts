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
