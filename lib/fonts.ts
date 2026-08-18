import {
  Geist,
  Geist_Mono,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Poppins,
} from "next/font/google";

/**
 * One font per script.
 *
 * All seven are declared on every page, but a browser only downloads a font
 * file when a glyph actually needs it — so a Tamil reader never pays for
 * Malayalam. `preload` is therefore off for the Indic faces: preloading would
 * force the download that the lazy behaviour is there to avoid. Latin is
 * preloaded because every page has Latin in it somewhere.
 *
 * `display: "swap"` throughout. On a slow rural connection, text in a fallback
 * face beats no text at all.
 */

export const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Display face for headings.
 *
 * Poppins. This was Fraunces, a serif run with its `WONK` axis switched on —
 * an axis whose entire purpose is to make letterforms irregular. At a body
 * paragraph that reads as character; at a sixty-pixel hero it reads as a font
 * that has gone wrong, which is what it was called out as.
 *
 * Geometric, round and wide, which is also what most of this market's audience
 * has already learnt to read: a farmer opening this on a budget Android has
 * seen these shapes in every government scheme poster and bank app they use.
 * Distinctiveness is worth less here than a heading nobody has to squint at.
 *
 * Weights are listed because Poppins is not a variable font — an unlisted
 * weight is silently synthesised by the browser and looks smeared.
 *
 * Latin only. Headings in the Indic scripts fall through to their own faces,
 * which is correct: a Latin display face has nothing to say about Tamil.
 */
export const heading = Poppins({
  variable: "--font-heading-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const tamil = Noto_Sans_Tamil({
  variable: "--font-tamil",
  subsets: ["tamil"],
  display: "swap",
  preload: false,
});

export const telugu = Noto_Sans_Telugu({
  variable: "--font-telugu",
  subsets: ["telugu"],
  display: "swap",
  preload: false,
});

export const kannada = Noto_Sans_Kannada({
  variable: "--font-kannada",
  subsets: ["kannada"],
  display: "swap",
  preload: false,
});

export const malayalam = Noto_Sans_Malayalam({
  variable: "--font-malayalam",
  subsets: ["malayalam"],
  display: "swap",
  preload: false,
});

export const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
  preload: false,
});

/** Every font variable, for the `<html>` class list. */
export const fontVariables = [
  sans.variable,
  heading.variable,
  mono.variable,
  tamil.variable,
  telugu.variable,
  kannada.variable,
  malayalam.variable,
  devanagari.variable,
].join(" ");
