import {
  Geist,
  Geist_Mono,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
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
  mono.variable,
  tamil.variable,
  telugu.variable,
  kannada.variable,
  malayalam.variable,
  devanagari.variable,
].join(" ");
