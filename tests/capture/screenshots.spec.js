// Captures the product shots that scripts/build-store-screenshots.mjs composes.
// Kept out of the e2e suite so `playwright test` stays free of side effects.
//
//   npm run capture
//
// The shop content is fictional, but it must be served from the one origin the
// extension holds a standing host permission for: everything else runs on
// activeTab, so the service worker cannot see or drive those tabs. The in-page
// shots carry no address bar, so the origin never appears in them.
const path = require("node:path");
const fs = require("node:fs");
const { test } = require("../e2e/fixtures");
const { openPopupForPage, runPageCommand, seedExtension } = require("../e2e/harness");
const { PROVIDER_CURRENCIES, RATES_BY_BASE, RATE_DATE } = require("../helpers/extension-state");

const SHOP_URL = "https://api.frankfurter.dev/shop/ceramics";
const SHOP_HTML = fs.readFileSync(path.resolve(__dirname, "../fixtures/capture-shop.html"), "utf8");
const ROOT = path.resolve(__dirname, "../..");

// Each store language shows prices converted into its shoppers' own money. The
// rates are round, plausible figures for illustration, not live market rates.
const PROVIDER = {
  currencies: [
    ...PROVIDER_CURRENCIES,
    { code: "BRL", name: "Brazilian Real", symbol: "R$", startDate: "1999-01-04", endDate: RATE_DATE }
  ].sort((left, right) => left.code.localeCompare(right.code)),
  ratesByBase: {
    ...RATES_BY_BASE,
    USD: { ...RATES_BY_BASE.USD, BRL: 5.59 },
    EUR: { EUR: 1, PLN: 4.265 }
  }
};
const PAIRS = [
  // English and the euro-zone listings. These also illustrate the README.
  { from: "USD", to: "EUR", out: path.join(ROOT, "screenshots") },
  // Polish shoppers buying from euro shops.
  { from: "EUR", to: "PLN", out: path.join(ROOT, "store/chrome/captures/eur-pln") },
  // Brazilian shoppers buying from US shops.
  { from: "USD", to: "BRL", out: path.join(ROOT, "store/chrome/captures/usd-brl") }
];

// The fixture is a US-dollar shop; a euro shop writes its prices the way a
// continental European shop would.
function shopHtml(currency) {
  if (currency !== "EUR") return SHOP_HTML;
  return SHOP_HTML
    .replace(/\$(\d+)\.(\d{2})/g, "$1,$2 €")
    .replace('<html lang="en">', '<html lang="de">');
}

async function openShop(context, currency, viewport = { width: 1180, height: 770 }) {
  const shop = await context.newPage();
  await shop.setViewportSize(viewport);
  await shop.route(SHOP_URL, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: shopHtml(currency)
  }));
  await shop.goto(SHOP_URL);
  return shop;
}

for (const pair of PAIRS) {
  const label = `${pair.from} to ${pair.to}`;
  const seed = (extensionWorker, settings = {}) => {
    fs.mkdirSync(pair.out, { recursive: true });
    return seedExtension(extensionWorker, {
      provider: PROVIDER,
      settings: { fromCurrency: pair.from, toCurrency: pair.to, ...settings }
    });
  };

  test(`capture popup, ${label}`, async ({ context, extensionWorker, extensionId }) => {
    await seed(extensionWorker);
    const shop = await openShop(context, pair.from);

    const popup = await openPopupForPage(context, extensionId, shop);
    await popup.setViewportSize({ width: 420, height: 620 });
    await popup.waitForFunction(() => document.getElementById("rateValue").textContent !== "—");
    await popup.waitForTimeout(1000);

    // Chrome sizes the real popup to its content, so clip to that rather than
    // baking the viewport's leftover whitespace into the image.
    const clip = await popup.evaluate(() => {
      const app = document.getElementById("popupApp");
      return { x: 0, y: 0, width: 420, height: Math.ceil(app.getBoundingClientRect().height) };
    });
    await popup.screenshot({ path: path.join(pair.out, "v2-popup-light.png"), clip });

    await popup.emulateMedia({ colorScheme: "dark" });
    await popup.waitForTimeout(250);
    await popup.screenshot({ path: path.join(pair.out, "v2-popup-dark.png"), clip });
  });

  test(`capture selection bubble, ${label}`, async ({ context, extensionWorker }) => {
    await seed(extensionWorker, { showPagePrompt: false });
    const shop = await openShop(context, pair.from);
    await runPageCommand(extensionWorker, "CONTENT_READY", SHOP_URL);

    // A real drag across the price, so the browser's own selection highlight is in
    // the shot and the bubble is positioned by the extension exactly as it would be.
    const price = await shop.locator("#p3").boundingBox();
    await shop.mouse.move(price.x + 1, price.y + (price.height / 2));
    await shop.mouse.down();
    await shop.mouse.move(price.x + price.width - 1, price.y + (price.height / 2), { steps: 12 });
    await shop.mouse.up();

    await shop.locator(".ccp-selection-popup").waitFor();
    await shop.waitForTimeout(400);

    // Crop around the bubble: at full width the interaction shrinks to a few dozen
    // pixels once the tile scales it down, and the point of the shot is lost. The
    // edges snap to card boundaries so the crop does not slice a product in half.
    const bubble = await shop.locator(".ccp-selection-popup").boundingBox();
    const left = await shop.locator(".card").nth(1).boundingBox();
    const right = await shop.locator(".card").nth(3).boundingBox();
    const top = await shop.locator(".thumb").first().boundingBox();
    const pad = 14;
    const clip = {
      x: left.x - pad,
      y: top.y - pad,
      width: (right.x + right.width + pad) - (left.x - pad),
      height: (bubble.y + bubble.height + pad) - (top.y - pad)
    };
    await shop.screenshot({ path: path.join(pair.out, "v2-inpage-selection.png"), clip });

    // The same frame after the bubble is used: the selection stays highlighted and
    // the bubble carries the converted figure instead of a generic verb.
    await shop.locator(".ccp-selection-popup").click();
    await shop.locator('.ccp-selection-popup[data-state="success"]').waitFor();
    await shop.waitForTimeout(300);
    await shop.screenshot({ path: path.join(pair.out, "v2-inpage-selection-done.png"), clip });
  });

  test(`capture in-page surfaces, ${label}`, async ({ context, extensionWorker }) => {
    await seed(extensionWorker, { showPagePrompt: true });
    // A narrower page reflows the shop into three columns, so the store tile can
    // show it close to real size and the converted prices stay readable in the
    // listing's small preview.
    const shop = await openShop(context, pair.from, { width: 800, height: 740 });
    await runPageCommand(extensionWorker, "CONTENT_READY", SHOP_URL);

    // Prompt first, on an unconverted page: that is the only state it appears in.
    await runPageCommand(extensionWorker, "SHOW_CONVERT_PROMPT", SHOP_URL);
    await shop.waitForTimeout(600);
    await shop.screenshot({ path: path.join(pair.out, "v2-inpage-prompt.png") });

    // Then convert, so the badges in the next shot are real conversions.
    await runPageCommand(extensionWorker, "RUN_SITE_CONVERSION", SHOP_URL);
    // At this width the result toast sits over the last product's price, so
    // dismiss it the way a shopper would; the converted badges are the point.
    const dismissToast = shop.locator(".ccp-toast-dismiss");
    if (await dismissToast.isVisible()) await dismissToast.click();
    await shop.waitForTimeout(600);
    await shop.screenshot({ path: path.join(pair.out, "v2-inpage.png") });
  });
}
