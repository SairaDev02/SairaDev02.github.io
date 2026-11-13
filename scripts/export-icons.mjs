// Exports the site's raster icons from public/favicon.svg: the 180 px apple-touch-icon and
// the fallback /favicon.ico, a real ICO holding 16 px and 32 px PNG images. Rendering uses
// the Playwright Chromium already in devDependencies, so no image package is needed.
// Run `npm run icons:export` and commit both files after the SVG or the palette changes.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SVG = fileURLToPath(new URL('../public/favicon.svg', import.meta.url));
const APPLE_TOUCH_ICON = fileURLToPath(new URL('../public/apple-touch-icon.png', import.meta.url));
const FAVICON_ICO = fileURLToPath(new URL('../public/favicon.ico', import.meta.url));
const APPLE_SIZE = 180;
const ICO_SIZES = [16, 32];

/** Renders the SVG at `size` px on a transparent page, as PNG bytes. */
async function renderPng(page, svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  return page.locator('svg').screenshot({ omitBackground: true });
}

/**
 * Packs PNG images into an ICO: the 6-byte ICONDIR, then one 16-byte entry per image and
 * its PNG payload. Browsers have accepted PNG payloads since Vista; each entry repeats the
 * image's size in a byte, where 0 would stand for 256.
 */
function ico(images) {
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0); // width
    entry.writeUInt8(size, 1); // height
    entry.writeUInt8(0, 2); // palette size: 0 means true colour
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.byteLength, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.byteLength;
    return entry;
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 is icon
  header.writeUInt16LE(images.length, 4);
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svg = await readFile(SVG, 'utf8');

  const appleTouchIcon = await renderPng(page, svg, APPLE_SIZE);
  const images = [];
  for (const size of ICO_SIZES) images.push({ size, png: await renderPng(page, svg, size) });

  await writeFile(APPLE_TOUCH_ICON, appleTouchIcon);
  await writeFile(FAVICON_ICO, ico(images));

  console.log(
    `apple-touch-icon.png ${APPLE_SIZE}x${APPLE_SIZE}, ${appleTouchIcon.byteLength} bytes; ` +
      `favicon.ico ${ICO_SIZES.join('+')} px, ${(await readFile(FAVICON_ICO)).byteLength} bytes`,
  );
} finally {
  await browser.close();
}
