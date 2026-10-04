const { test, expect } = require("./fixtures");
const {
  DEFAULT_SHOP_URL: SHOP_URL,
  runPageCommand,
  seedExtension
} = require("./harness");

const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Selection</title></head>
<body style="font: 28px sans-serif"><p>Helmet <span id="eur">€89.00</span></p>
<p>Bell <span id="pln">PLN 49.90</span></p></body></html>`;

async function openPage(context) {
  const page = await context.newPage();
  await page.route(SHOP_URL, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: HTML
  }));
  await page.goto(SHOP_URL);
  return page;
}

// A real drag across the price, the way a person selects it.
async function dragSelect(page, id) {
  await page.evaluate(() => window.getSelection().removeAllRanges());
  const box = await page.locator(`#${id}`).boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 1, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, y, { steps: 8 });
  await page.mouse.up();
}

function setSettings(extensionWorker, settings) {
  return extensionWorker.evaluate((values) => chrome.storage.sync.set(values), settings);
}

// The page loads its settings asynchronously, so keep selecting until it answers.
async function expectSelectionControl(page, id, check) {
  await expect(async () => {
    await dragSelect(page, id);
    await check(page.locator(".ccp-selection-popup"));
  }).toPass({ timeout: 20_000 });
}

test("a price already in the target currency explains itself, and one that converts offers the button", async ({
  context,
  extensionWorker
}) => {
  await seedExtension(extensionWorker, {
    settings: { fromCurrency: "AUTO", toCurrency: "EUR", showPagePrompt: false }
  });
  const page = await openPage(context);

  // Already in euros: nothing to convert, and the page says why instead of staying silent.
  await expectSelectionControl(page, "eur", async (control) => {
    await expect(control).toHaveAttribute("data-state", "info", { timeout: 1500 });
    await expect(control).toHaveText("This price is already in EUR", { timeout: 1500 });
  });
  await expect(page.locator(".ccp-selection-popup")).toHaveAttribute("aria-disabled", "true");
  const sameAsTarget = await runPageCommand(extensionWorker, "CONVERT_SELECTION");
  expect(sameAsTarget).toMatchObject({
    ok: false,
    error: "This price is already in EUR. Change the target currency to convert it."
  });

  // The same price converts as soon as the target is another currency.
  await setSettings(extensionWorker, { toCurrency: "USD" });
  await expectSelectionControl(page, "eur", async (control) => {
    await expect(control).toHaveText("Convert selection", { timeout: 1500 });
  });

  // A price written with the code first, the way Allegro writes it, behaves the same way.
  await setSettings(extensionWorker, { toCurrency: "PLN" });
  await expectSelectionControl(page, "pln", async (control) => {
    await expect(control).toHaveText("This price is already in PLN", { timeout: 1500 });
  });
  await setSettings(extensionWorker, { toCurrency: "EUR" });
  await expectSelectionControl(page, "pln", async (control) => {
    await expect(control).toHaveText("Convert selection", { timeout: 1500 });
  });
});
