import type { MetadataRoute } from "next";

/**
 * The installable app, which is the farmer's console.
 *
 * A grower uses this standing in a field on a mid-range Android phone. Installed
 * to the home screen it opens without browser chrome, keeps its own task in the
 * switcher, and — the part that actually matters — is one tap away rather than a
 * URL somebody has to remember and type on a handset keyboard.
 *
 * `start_url` is `/farm` rather than `/`. Landing on the marketing site from a
 * home-screen icon would be absurd for somebody who has already registered, and
 * the other roles are not stranded by it: `requireConsole` sends a buyer opening
 * `/farm` to their own console, and a signed-out visitor to sign in.
 *
 * `scope` stays `/` so sign-in, the profile step and the public pages are all
 * inside the installed app. A narrower scope would open those in a browser tab
 * mid-flow, which is exactly where somebody abandons a registration.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pasumai Trade",
    short_name: "Pasumai",
    description: "List what you grow, and settle the price yourself.",
    start_url: "/farm",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8f4",
    theme_color: "#1c5b3e",
    // `lang` is the default only. The console reads the language cookie on every
    // render, so an installed app follows whatever the person last chose.
    lang: "en",
    dir: "ltr",
    categories: ["business", "productivity", "shopping"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        // `any` and not `maskable`: these are drawn with their own padding, and
        // declaring maskable would let Android crop into the mark.
        purpose: "any",
      },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
