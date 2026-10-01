// Renders the Chrome Web Store small promo tile (440x280).
//
// Same approach as build-icons.mjs: Chromium already ships with Playwright, so
// the tile is rasterized in a real renderer instead of adding an image library.
// Colors are the extension's own — the icon gradient and the default converted
// price badge — so the tile matches what a user actually sees after installing.
//
// The tile shows a product card as it looks on a shop page after conversion: the
// original price with the "≈" badge right beside it. That pairing is what the
// extension does and what the name means. The tagline is a single line so it
// stays readable when the store shows the tile at half size.
//
// The store shows one promo tile in every language (unlike screenshots, it
// cannot be localized), so the copy is English. Dollars to yen is used because
// the converted number is obviously different even at thumbnail size.
//
//   node scripts/build-promo-tile.mjs [--out store/chrome/promo]

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDTH = 440;
const HEIGHT = 280;

// src/icons + scripts/build-icons.mjs
const BRAND = "#1b3fbf";
const BRAND_DEEP = "#16327e";
const GLYPH = "#ffffff";
// CurrencySettings.DEFAULTS converted-price appearance
const BADGE_TEXT = "#166534";
const BADGE_FILL = "#dcfce7";

const markup = `
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 26px 30px 24px;
    box-sizing: border-box;
    background:
      radial-gradient(120% 90% at 82% 8%, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 58%),
      linear-gradient(160deg, ${BRAND} 0%, ${BRAND_DEEP} 100%);
    font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: ${GLYPH};
    overflow: hidden;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark { display: block; flex: none; }
  .name {
    font-size: 25px;
    font-weight: 700;
    letter-spacing: -.017em;
    line-height: 1;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 15px 18px 17px;
    border-radius: 12px;
    background: #ffffff;
    color: #101725;
    box-shadow: 0 16px 32px -10px rgba(6, 12, 32, .6), 0 2px 6px rgba(6, 12, 32, .25);
  }
  .product {
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    color: #5a6b87;
  }
  .prices {
    display: flex;
    align-items: center;
    gap: 10px;
    font-variant-numeric: tabular-nums;
  }
  .price {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: -.02em;
    line-height: 1;
    white-space: nowrap;
  }
  .twin {
    background: ${BADGE_FILL};
    color: ${BADGE_TEXT};
    font-size: 35px;
    font-weight: 700;
    letter-spacing: -.02em;
    line-height: 1;
    padding: 5px 10px;
    border-radius: .3em;
    white-space: nowrap;
  }
  .tag {
    margin: 0;
    font-size: 20px;
    font-weight: 650;
    line-height: 1.2;
    white-space: nowrap;
  }
</style>

<div class="brand">
  <svg class="mark" width="44" height="44" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(255,255,255,.22)"/>
        <stop offset="1" stop-color="rgba(255,255,255,.10)"/>
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="11" fill="url(#tile)"/>
    <rect x=".75" y=".75" width="46.5" height="46.5" rx="10.4"
          fill="none" stroke="rgba(255,255,255,.34)" stroke-width="1.5"/>
    <g fill="none" stroke="${GLYPH}" stroke-width="4.2"
       stroke-linecap="round" stroke-linejoin="round">
      <path d="M31.5 15.5H21a5.25 5.25 0 0 0 0 10.5h6a5.25 5.25 0 0 1 0 10.5H16"/>
      <path d="M24 9.5v29"/>
    </g>
  </svg>
  <span class="name">Twinprice</span>
</div>

<div class="card">
  <span class="product">Desk lamp</span>
  <div class="prices">
    <span class="price">$68.00</span>
    <span class="twin">≈ ￥10,200</span>
  </div>
</div>

<p class="tag">Every price in your currency.</p>
`;

const outDir = (() => {
  const flag = process.argv.indexOf("--out");
  return resolve(ROOT, flag === -1 ? "store/chrome/promo" : process.argv[flag + 1]);
})();

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(markup);
  const png = await page.screenshot();
  const file = resolve(outDir, `small-promo-tile-${WIDTH}x${HEIGHT}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
} finally {
  await browser.close();
}
