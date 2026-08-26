/**
 * Render the installed-app icons from the same three paths the component uses.
 *
 * These are the one place the mark has to exist as pixels — Android and iOS
 * will not take an SVG — so they are generated rather than drawn, and the
 * geometry is pasted from components/marketing/brand-mark.tsx. Re-run after
 * redrawing the mark.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const GREEN = "#1c5b3e";
const BG = "#f6f8f4"; // manifest background_color

const CENTRE = "M24 4C30.5 11.5 32.5 22 24 32 15.5 22 17.5 11.5 24 4Z";
const LEFT = "M24 31.5C18 33.5 10.5 29.5 6.5 18.5 15 18.5 22 23 24 31.5Z";
const RIGHT = "M24 31.5C30 33.5 37.5 29.5 41.5 18.5 33 18.5 26 23 24 31.5Z";

/**
 * The mark fills 68% of the tile. `purpose: "any"` means the launcher does not
 * crop, but it may still round the corners, and a mark that runs to the edge
 * loses its leaf tips to the rounding on exactly the phones least able to
 * spare them.
 */
function tile(size) {
  const inset = size * 0.16;
  const span = size - inset * 2;
  const radius = size * 0.22;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <g transform="translate(${inset} ${inset}) scale(${span / 48})">
    <circle cx="24" cy="24" r="21.4" stroke="${GREEN}" stroke-width="1.3" opacity="0.3" fill="none"/>
    <path d="M24 41.5V30" stroke="${GREEN}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="${LEFT}" fill="${GREEN}" opacity="0.72"/>
    <path d="${RIGHT}" fill="${GREEN}" opacity="0.72"/>
    <path d="${CENTRE}" fill="${GREEN}"/>
  </g>
</svg>`;
}

for (const size of [192, 512]) {
  const out = `f:/pasumai-trade/public/icon-${size}.png`;
  await sharp(Buffer.from(tile(size))).png({ compressionLevel: 9 }).toFile(out);
  console.log(`wrote icon-${size}.png`);
}

// iOS home screens. Apple does not round-trip an SVG and does not read the
// manifest, so this file is the only mark an installed-to-homescreen iPhone
// ever sees. It carries the dish: 180px is plenty for a hairline.
await sharp(Buffer.from(tile(180))).png({ compressionLevel: 9 })
  .toFile("f:/pasumai-trade/app/apple-icon.png");
console.log("wrote apple-icon.png");

// The .ico the browser asks for by name. 32px is what tab strips render at,
// and the dish is dropped there for the same reason it is dropped in icon.svg.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 48 48">
  <path d="M24 41.5V30" stroke="${GREEN}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="${LEFT}" fill="${GREEN}" opacity="0.72"/>
  <path d="${RIGHT}" fill="${GREEN}" opacity="0.72"/>
  <path d="${CENTRE}" fill="${GREEN}"/>
</svg>`;

/*
  An .ico wrapping a 32px PNG. The format has allowed a PNG payload since
  Vista and every browser that still asks for favicon.ico by name accepts one,
  so this is a 22-byte header in front of the same image rather than a real
  bitmap encoder. sharp has no .ico writer; hand-assembling the container is
  less machinery than adding a dependency for one file.

  It exists at all because Safari on older macOS will not take icon.svg, and
  Next serves app/favicon.ico ahead of app/icon.svg when both are present.
*/
const png32 = await sharp(Buffer.from(favicon)).resize(32, 32).png().toBuffer();
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
writeFileSync("f:/pasumai-trade/app/favicon.ico", ico);
console.log("wrote favicon.ico");
