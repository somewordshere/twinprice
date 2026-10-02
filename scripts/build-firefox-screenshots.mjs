// Numbers the Chrome Web Store screenshots for the Firefox listing.
//
// Firefox shows the same English screenshots as Chrome in every language, so this
// does not compose anything new. It takes the finished English set from
// store/chrome/screenshots/en and stamps the position (1, 2, 3, ...) in the top-left
// corner of each image, so the listing's captions can refer to them by number.
//
//   npm run build:firefox-screenshots
//
// The source images stay untouched; the numbered copies go to store/firefox/screenshots.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "store/chrome/screenshots/en");
const OUT = resolve(ROOT, "store/firefox/screenshots");
const WIDTH = 1280;
const HEIGHT = 800;

if (!existsSync(SOURCE)) {
  throw new Error(`Missing ${SOURCE}. Build the Chrome store screenshots first.`);
}
// The leading digits of each file name are its place in the store's order.
const files = readdirSync(SOURCE).filter((name) => /^\d+-.+\.png$/.test(name)).sort();
if (!files.length) throw new Error(`No numbered screenshots found in ${SOURCE}.`);

function markup(imageUri, number) {
  return `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; position: relative; overflow: hidden; }
  img { display: block; width: ${WIDTH}px; height: ${HEIGHT}px; }
  .number {
    position: absolute; top: 32px; left: 36px;
    width: 60px; height: 60px; border-radius: 50%;
    display: grid; place-items: center;
    background: #fff; color: #1b3fbf;
    font: 700 34px/1 "Segoe UI", system-ui, -apple-system, sans-serif;
    box-shadow: 0 6px 16px rgba(6, 12, 32, .35);
  }
</style></head><body><img src="${imageUri}" alt=""><div class="number">${number}</div></body></html>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  for (const [index, file] of files.entries()) {
    const bytes = readFileSync(resolve(SOURCE, file));
    await page.setContent(markup(`data:image/png;base64,${bytes.toString("base64")}`, index + 1));
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    writeFileSync(resolve(OUT, file), png);
    console.log(`wrote firefox/${file} as number ${index + 1} (${(png.length / 1024).toFixed(0)}KB)`);
  }
} finally {
  await browser.close();
}
