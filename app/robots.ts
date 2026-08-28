import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/**
 * What a crawler may spend its time on.
 *
 * ## What is disallowed, and what deliberately is not
 *
 * The consoles are listed. Every one of them is behind `requireConsole` and
 * answers a signed-out request with a redirect, so nothing there could be
 * indexed anyway — but a crawler does not know that until it has fetched the
 * URL and followed the bounce, and there are a lot of them. This is about not
 * spending the site's crawl budget discovering that eight console trees are
 * all closed.
 *
 * `/signin` and `/signup` are **not** listed, and that is not an oversight.
 * Both already answer with `robots: { index: false }` in their metadata, and a
 * crawler has to be able to *fetch* a page to read that. Disallowing them here
 * would hide the very instruction that keeps them out of the index — which is
 * how a URL ends up listed with no title and no description, the exact outcome
 * the noindex was for. Pick one mechanism; noindex is the one that works.
 *
 * `/api/` is listed because those routes are neither pages nor private — they
 * are simply not documents, and a crawler reading them learns nothing.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/agency",
          "/farm",
          "/franchise",
          "/account",
          "/bargains",
          "/home",
          "/listings",
          "/notifications",
          "/orders",
          "/overview",
          "/profile",
          "/renew",
          "/offline",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
