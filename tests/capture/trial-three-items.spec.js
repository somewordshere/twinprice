// Temporary trial of a new screenshot set; delete this file after the decision.
// TRIAL_PAIR picks the currencies: usd-eur (English, the default) or eur-pln
// (Polish). Writes v3-*.png to store/chrome/captures/<pair>/.
const path = require("node:path");
const fs = require("node:fs");
const { test } = require("../e2e/fixtures");
const { test: plainTest, chromium } = require("@playwright/test");
const { openPopupForPage, runPageCommand, seedExtension } = require("../e2e/harness");
const { PROVIDER_CURRENCIES, RATES_BY_BASE } = require("../helpers/extension-state");

// Served from the rate provider's origin, the one site the extension always
// holds access to, so the popup can see and drive the tab.
const SHOP_URL = "https://api.frankfurter.dev/shop/ceramics";
const FIXTURE = fs.readFileSync(path.resolve(__dirname, "../fixtures/capture-shop.html"), "utf8");
const PAIRS = {
  "usd-eur": { from: "USD", to: "EUR", html: FIXTURE },
  "eur-pln": {
    from: "EUR",
    to: "PLN",
    html: FIXTURE
      .replace(/\$(\d+)\.(\d{2})/g, "$1,$2 €")
      .replace('<html lang="en">', '<html lang="de">')
  }
};
const PAIR_ID = process.env.TRIAL_PAIR || "usd-eur";
const PAIR = PAIRS[PAIR_ID];
const OUT = path.resolve(__dirname, "../../store/chrome/captures", PAIR_ID);
const EXTENSION = path.resolve(__dirname, "../../dist/chrome");

// The most recent working day, so the rate shown never looks months old.
function recentRateDate(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
const RATE_DATE = recentRateDate();
const PROVIDER = {
  currencies: [...PROVIDER_CURRENCIES,
    { code: "BRL", name: "Brazilian Real", symbol: "R$", startDate: "1999-01-04" }]
    .map((currency) => ({ ...currency, endDate: RATE_DATE }))
    .sort((left, right) => left.code.localeCompare(right.code)),
  ratesByBase: { ...RATES_BY_BASE, USD: { ...RATES_BY_BASE.USD, BRL: 5.59 }, EUR: { EUR: 1, PLN: 4.265 } },
  rateDate: RATE_DATE
};
const SETTINGS = { fromCurrency: PAIR.from, toCurrency: PAIR.to };

async function openShop(context, viewport, style) {
  fs.mkdirSync(OUT, { recursive: true });
  const shop = await context.newPage();
  await shop.setViewportSize(viewport);
  await shop.route(SHOP_URL, (route) => route.fulfill({
    status: 200, contentType: "text/html; charset=utf-8", body: PAIR.html
  }));
  await shop.goto(SHOP_URL);
  if (style) await shop.addStyleTag({ content: style });
  return shop;
}

// Smaller product pictures (a 4:3 thumbnail narrower than its column) and
// larger prices kept on one line: the converted prices are the point of these
// shots, and the text keeps the full column so names do not wrap.
const THREE_PRODUCTS = [
  ".grid > .card:nth-child(n+4), .meta { display: none; }",
  "header { padding-inline: 30px; }",
  "main { padding: 34px 30px; }",
  ".grid { grid-template-columns: repeat(3, 1fr); }",
  ".thumb { width: 188px; height: 141px; }",
  ".price { font-size: 23px; white-space: nowrap; }"
].join(" ");

async function openThreeProducts(context, extensionWorker) {
  const shop = await openShop(context, { width: 800, height: 740 }, THREE_PRODUCTS);
  await runPageCommand(extensionWorker, "CONTENT_READY", SHOP_URL);
  const clip = async () => {
    const bottom = await shop.evaluate(() => Math.ceil(document.querySelector("main").getBoundingClientRect().bottom));
    return { x: 0, y: 0, width: 800, height: bottom };
  };
  return { shop, clip };
}

// The page as a shopper first meets it: foreign prices and nothing else. The
// offer is switched off so no extension UI appears.
test(`trial: plain page, ${PAIR_ID}`, async ({ context, extensionWorker }) => {
  await seedExtension(extensionWorker, { provider: PROVIDER, settings: { ...SETTINGS, showPagePrompt: false } });
  const { shop, clip } = await openThreeProducts(context, extensionWorker);
  await shop.waitForTimeout(600);
  await shop.screenshot({ path: path.join(OUT, "v3-inpage-plain.png"), clip: await clip() });
});

test(`trial: three products, ${PAIR_ID}`, async ({ context, extensionWorker }) => {
  await seedExtension(extensionWorker, { provider: PROVIDER, settings: { ...SETTINGS, showPagePrompt: true } });
  const { shop, clip } = await openThreeProducts(context, extensionWorker);

  await runPageCommand(extensionWorker, "SHOW_CONVERT_PROMPT", SHOP_URL);
  await shop.waitForTimeout(600);
  await shop.screenshot({ path: path.join(OUT, "v3-inpage-prompt.png"), clip: await clip() });

  await runPageCommand(extensionWorker, "RUN_SITE_CONVERSION", SHOP_URL);
  const dismissToast = shop.locator(".ccp-toast-dismiss");
  if (await dismissToast.isVisible()) await dismissToast.click();
  await shop.waitForTimeout(600);
  await shop.screenshot({ path: path.join(OUT, "v3-inpage.png"), clip: await clip() });
});

test(`trial: popup, ${PAIR_ID}`, async ({ context, extensionWorker, extensionId }) => {
  await seedExtension(extensionWorker, { provider: PROVIDER, settings: SETTINGS });
  const shop = await openShop(context, { width: 1180, height: 770 });

  const popup = await openPopupForPage(context, extensionId, shop);
  await popup.setViewportSize({ width: 420, height: 620 });
  await popup.waitForFunction(() => document.getElementById("rateValue").textContent !== "—");
  await popup.waitForTimeout(1000);
  // The footer names the current site, which here is the rate provider's
  // address rather than a shop's; hide it instead of inventing a shop domain.
  await popup.evaluate(() => { document.getElementById("siteState").style.visibility = "hidden"; });
  const clip = await popup.evaluate(() => {
    const app = document.getElementById("popupApp");
    return { x: 0, y: 0, width: 420, height: Math.ceil(app.getBoundingClientRect().height) };
  });
  await popup.screenshot({ path: path.join(OUT, "v3-popup-light.png"), clip });
});

// CSS zoom would misplace the selection bubble, so this shot is rendered at
// twice the pixel density instead and shown larger in the tile.
plainTest(`trial: one product, highlighted price, ${PAIR_ID}`, async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`]
  });
  try {
    context.on("page", (page) => {
      if (page.url().includes("onboarding/onboarding.html")) page.close().catch(() => {});
    });
    let [extensionWorker] = context.serviceWorkers();
    if (!extensionWorker) extensionWorker = await context.waitForEvent("serviceworker");
    await seedExtension(extensionWorker, { provider: PROVIDER, settings: { ...SETTINGS, showPagePrompt: false } });
    // One product with a small picture beside a large price, so the price and
    // its conversion sit in the middle of the frame instead of under a picture.
    const shop = await openShop(context, { width: 520, height: 600 }, [
      "h1, .sub, .meta, .grid > .card:not(:nth-child(3)) { display: none; }",
      "header { padding: 18px 30px; }",
      "main { padding: 32px 30px 30px; }",
      ".grid { grid-template-columns: 1fr; max-width: none; }",
      ".card { display: grid; grid-template-columns: 128px 1fr; column-gap: 24px; row-gap: 8px; align-items: center; }",
      ".thumb { grid-row: 1 / span 2; width: 128px; height: 96px; }",
      ".card > .name { grid-column: 2; align-self: end; font-size: 17px; }",
      ".card > .price { grid-column: 2; align-self: start; font-size: 37px; white-space: nowrap; }"
    ].join(" "));
    await runPageCommand(extensionWorker, "CONTENT_READY", SHOP_URL);

    const price = await shop.locator("#p3").boundingBox();
    await shop.mouse.move(price.x + 1, price.y + (price.height / 2));
    await shop.mouse.down();
    await shop.mouse.move(price.x + price.width - 1, price.y + (price.height / 2), { steps: 12 });
    await shop.mouse.up();
    await shop.locator(".ccp-selection-popup").waitFor();
    await shop.locator(".ccp-selection-popup").click();
    await shop.locator('.ccp-selection-popup[data-state="success"]').waitFor();
    await shop.waitForTimeout(300);

    const card = await shop.locator(".grid > .card:nth-child(3)").boundingBox();
    const bubble = await shop.locator(".ccp-selection-popup").boundingBox();
    const bottom = Math.ceil(Math.max(card.y + card.height, bubble.y + bubble.height) + 30);
    await shop.screenshot({
      path: path.join(OUT, "v3-inpage-selection-done.png"),
      clip: { x: 0, y: 0, width: 520, height: bottom }
    });
  } finally {
    await context.close();
  }
});
