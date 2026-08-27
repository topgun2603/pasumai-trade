/**
 * Render the installed-app icons from the same image the application draws.
 *
 * These are the one place the mark has to exist as pixels — Android and iOS
 * will not take an SVG — so they are generated rather than drawn.
 *
 * The source used to be three path strings pasted from
 * components/marketing/brand-mark.tsx, which meant the home-screen icon was a
 * flat green sprout while every screen behind it showed the photograph. Two
 * drawings of one mark is two marks. It reads from public/logo-mark.png now:
 * the same file `BrandLogo` renders, so the icon a phone shows on its home
 * screen is the icon the app shows when it opens.
 *
 * Re-run after replacing that file:  node scripts/build-icons.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file rather than from the working directory, and never
// written out as an absolute path: the previous version hardcoded `f:/` and so
// only ran on the machine it was written on.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "public", "logo-mark.png");

const BG = "#f6f8f4"; // manifest background_color

/**
 * The mark fills 68% of the tile. `purpose: "any"` means the launcher does not
 * crop, but it may still round the corners, and a mark that runs to the edge
 * loses its leaf tips to the rounding on exactly the phones least able to
 * spare them.
 *
 * The ground is opaque rather than transparent. The mark was cut out of its
 * white background so it could sit on a dark theme, which is right in the
 * application and wrong here — a launcher, a tab strip and an iOS home screen
 * each supply their own backdrop, and dark leaves on a dark one disappear.
 */
async function tile(size) {
  const inset = Math.round(size * 0.16);
  const span = size - inset * 2;
  const radius = Math.round(size * 0.22);

  const ground = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
</svg>`;

  const mark = await sharp(SOURCE)
    .resize(span, span, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp(Buffer.from(ground))
    .composite([{ input: mark, top: inset, left: inset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

for (const size of [192, 512]) {
  writeFileSync(join(ROOT, "public", `icon-${size}.png`), await tile(size));
  console.log(`wrote icon-${size}.png`);
}

// iOS home screens. Apple does not round-trip an SVG and does not read the
// manifest, so this file is the only mark an installed-to-homescreen iPhone
// ever sees.
writeFileSync(join(ROOT, "app", "apple-icon.png"), await tile(180));
console.log("wrote apple-icon.png");

/*
  The browser-tab mark.

  This replaces app/icon.svg, which was the drawn sprout written out by hand.
  A photograph cannot be an SVG, and Next takes app/icon.png just as happily —
  so the tab now shows the same mark as everything else. 64px covers the 32px
  a tab strip renders at on a 2x display.
*/
writeFileSync(join(ROOT, "app", "icon.png"), await tile(64));
console.log("wrote icon.png");

/*
  An .ico wrapping a 32px PNG. The format has allowed a PNG payload since
  Vista and every browser that still asks for favicon.ico by name accepts one,
  so this is a 22-byte header in front of the same image rather than a real
  bitmap encoder. sharp has no .ico writer; hand-assembling the container is
  less machinery than adding a dependency for one file.

  It exists at all because Safari on older macOS will not take a PNG icon, and
  Next serves app/favicon.ico ahead of app/icon.png when both are present.
*/
const png32 = await tile(32);
const ico = Buffer.alloc(22 + png32.length);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // one image
ico.writeUInt8(32, 6); // width
ico.writeUInt8(32, 7); // height
ico.writeUInt8(0, 8); // palette colours: none, it is truecolour
ico.writeUInt8(0, 9); // reserved
ico.writeUInt16LE(1, 10); // colour planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png32.length, 14);
ico.writeUInt32LE(22, 18); // payload offset
png32.copy(ico, 22);
writeFileSync(join(ROOT, "app", "favicon.ico"), ico);
console.log("wrote favicon.ico");
