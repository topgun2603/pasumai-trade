import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { LOCALES } from "@/lib/i18n/config";

/**
 * The card every share of this site renders as.
 *
 * Until now there was none, so a link pasted into WhatsApp — which is how this
 * platform actually spreads — came out as a bare grey rectangle. This is the
 * highest-traffic image on the site and it is generated once at build time.
 *
 * ## Why the card is in Latin script when the site is in six
 *
 * Satori, which `ImageResponse` draws with, needs the font file for every glyph
 * it renders and has no fallback: a Tamil string without a Tamil font comes out
 * as a row of empty boxes, silently, in the one image we cannot inspect after
 * the fact. Six Indic font files embedded in a build-time route to produce six
 * cards is real weight and six chances to ship tofu.
 *
 * The card is therefore language-neutral — the mark, the name in the Latin form
 * that is on the invoices, and three words of English. The page behind it is
 * still served in the reader's language, and the `og:description` beside this
 * image *is* translated, so what a person reads in the preview is their
 * language even though the picture is not.
 *
 * Worth revisiting if sharing turns out to skew to one language: one Tamil card
 * with one font file is a far smaller job than six.
 */
export const alt = "Pasumai Trade — live mandi prices and direct farm trade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Prerendered per locale, like the pages. Without this the route is generated
 * on demand, and the first crawler to ask for the card waits for it to render.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

const BACKGROUND = "#f6f8f4";
const GREEN = "#1c5b3e";
const MUTED = "#5b6b5f";

export default async function Image() {
  // The same file the application draws, read off disk rather than fetched:
  // this runs at build time, when there is no server to fetch from.
  const mark = await readFile(join(process.cwd(), "public", "logo-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
          background: BACKGROUND,
          // A wide band of the brand green along the bottom, so the card still
          // reads as ours when it is scaled to a thumbnail in a chat list and
          // the text is too small to make out.
          borderBottom: `18px solid ${GREEN}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSrc} alt="" width={190} height={190} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 78, fontWeight: 700, color: GREEN }}>
            Pasumai Trade
          </div>
          <div style={{ fontSize: 34, color: MUTED }}>
            Mandi prices · Direct trade · Six languages
          </div>
        </div>
      </div>
    ),
    size,
  );
}
