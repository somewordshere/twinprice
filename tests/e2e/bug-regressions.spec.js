const { test, expect } = require("./fixtures");
const { seedExtension, runPageCommand, openPopupForPage, DEFAULT_SHOP_URL } = require("./harness");

for (const displayMode of ["beside", "replace"]) {
  test(`changing split prices and revealing existing prices update in ${displayMode} mode`, async ({ context, extensionWorker }) => {
    await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", toCurrency: "EUR", displayMode } });
    const page = await context.newPage();
    await page.route(DEFAULT_SHOP_URL, route => route.fulfill({ contentType: "text/html", body: `
      ${displayMode === "beside" ? '<meta itemprop="priceCurrency" content="USD">' : ''}
      <style>.invisible { display: none; }</style>
      <p id="price" class="price"><b>$</b><span id="amount">100.00</span></p>
      <section id="hidden" hidden><p class="price">USD 50.00</p></section>
      <section id="classHidden" class="invisible"><p class="price">USD 60.00</p></section>
      <p id="foreign" class="price">CA$100.00</p>
      <p id="negative" class="price">-10.00 USD</p>
    ` }));
    await page.goto(DEFAULT_SHOP_URL);
    await runPageCommand(extensionWorker, "RUN_SITE_CONVERSION");
    await expect(page.locator("#price ccp-conversion")).toHaveAttribute("data-ccp-appended", "true");
    await expect(page.locator("#price .ccp-badge")).toHaveText("≈ 90,00 €");
    await expect(page.locator("#foreign ccp-conversion")).toHaveCount(0);
    await expect(page.locator("#negative .ccp-badge")).toHaveText("≈ -9,00 €");
    await page.evaluate(() => {
      document.querySelector("#amount").firstChild.nodeValue = "200.00";
      document.querySelector("#hidden").hidden = false;
      document.querySelector("#classHidden").classList.remove("invisible");
    });
    await expect(page.locator("#price .ccp-badge")).toHaveText("≈ 180,00 €");
    await expect(page.locator("#hidden .ccp-badge")).toHaveText("≈ 45,00 €");
    await expect(page.locator("#classHidden .ccp-badge")).toHaveText("≈ 54,00 €");
    await page.locator("#amount").evaluate(node => { node.textContent = "300.00"; });
    await expect(page.locator("#price .ccp-badge")).toHaveText("≈ 270,00 €");
    await expect(page.locator("#price ccp-conversion")).toHaveCount(1);
    if (displayMode === "replace") await expect(page.locator("#amount")).toBeHidden();
    const selection = await extensionWorker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED",
        func: () => CurrencyPageConverter.convertSelectionText("-10.00 USD", document.querySelector("#negative")) });
      return result;
    }, DEFAULT_SHOP_URL);
    expect(selection.converted).toBe("-9,00 €");
    await runPageCommand(extensionWorker, "CLEAR_SITE_CONVERSION");
    await expect(page.locator("#price")).toHaveText("$300.00");
    await expect(page.locator("#negative")).toHaveText("-10.00 USD");
    await expect(page.locator("ccp-conversion")).toHaveCount(0);
  });
}

test("popup preserves three-decimal currency amounts and rejects malformed input", async ({ context, extensionWorker, extensionId }) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", toCurrency: "EUR" } });
  await extensionWorker.evaluate(async () => {
    const stored = await chrome.storage.local.get(["providerCurrencyCatalog", "ratesCache"]);
    stored.providerCurrencyCatalog.currencies.push({ code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", startDate: "1999-01-01", endDate: new Date().toISOString().slice(0, 10) });
    stored.providerCurrencyCatalog.currencies.sort((a, b) => a.code.localeCompare(b.code));
    const catalogSignature = stored.providerCurrencyCatalog.currencies.map(item => item.code).join(",");
    stored.ratesCache.bases.KWD = { fetchedAt: new Date().toISOString(), rateDate: "2026-07-10", catalogSignature, rates: { KWD: 1, EUR: 3 } };
    await chrome.storage.local.set(stored);
    await chrome.storage.sync.set({ fromCurrency: "KWD" });
  });
  const activePage = await context.newPage();
  const popup = await openPopupForPage(context, extensionId, activePage);
  await expect(popup.locator("#fromCurrency")).toHaveValue("KWD");
  for (const value of ["1.234", "1,234"]) {
    await popup.locator("#quickAmount").fill(value);
    await expect(popup.locator("#quickResult")).toHaveText("3,70 €");
  }
  for (const value of ["100oops", "1.2.3"]) {
    await popup.locator("#quickAmount").fill(value);
    await expect(popup.locator("#quickResult")).toHaveText("Invalid amount");
  }
  await popup.locator("#quickAmount").fill("-1.234");
  await expect(popup.locator("#quickResult")).toHaveText("-3,70 €");
});

test("visible display-contents prices convert and multi-price selections are rejected", async ({ context, extensionWorker }) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", toCurrency: "EUR" } });
  const page = await context.newPage();
  await page.route(DEFAULT_SHOP_URL, route => route.fulfill({
    contentType: "text/html",
    body: '<p id="contents" class="price" style="display: contents">USD 70.00</p><p id="selection">$10 and $20</p>'
  }));
  await page.goto(DEFAULT_SHOP_URL);
  const conversion = await runPageCommand(extensionWorker, "RUN_SITE_CONVERSION");
  expect(conversion.ok).toBe(true);
  await expect(page.locator("#contents .ccp-badge")).toHaveText("≈ 63,00 €");

  const selection = await extensionWorker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(candidate => candidate.url === url);
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
      func: () => CurrencyPageConverter.convertSelectionText(
        "$10 and $20",
        document.querySelector("#selection")
      )
    });
    return result;
  }, DEFAULT_SHOP_URL);
  expect(selection).toEqual({ ok: false, error: "Select one price at a time." });
});

test("fresh background rates replace rates already loaded by a converted page", async ({ context, extensionWorker }) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", toCurrency: "EUR" } });
  const page = await context.newPage();
  await page.route(DEFAULT_SHOP_URL, route => route.fulfill({
    contentType: "text/html",
    body: '<p id="price" class="price">USD 100.00</p>'
  }));
  await page.goto(DEFAULT_SHOP_URL);
  await runPageCommand(extensionWorker, "RUN_SITE_CONVERSION");
  await expect(page.locator("#price .ccp-badge")).toHaveText("≈ 90,00 €");

  await extensionWorker.evaluate(async () => {
    const { ratesCache } = await chrome.storage.local.get("ratesCache");
    ratesCache.bases.USD = {
      ...ratesCache.bases.USD,
      fetchedAt: "2026-09-18T12:00:00.000Z",
      rateDate: "2026-09-18",
      rates: { ...ratesCache.bases.USD.rates, EUR: 0.8 }
    };
    await chrome.storage.local.set({ ratesCache });
  });

  await expect(page.locator("#price .ccp-badge")).toHaveText("≈ 80,00 €");
});

test("automatic detection rechecks prices added later on the same URL", async ({ context, extensionWorker }) => {
  await seedExtension(extensionWorker, {
    settings: { fromCurrency: "AUTO", toCurrency: "EUR", showPagePrompt: true }
  });
  const page = await context.newPage();
  await page.route(DEFAULT_SHOP_URL, route => route.fulfill({
    contentType: "text/html",
    body: '<html lang="tr"><body><main id="catalog">Ürünler yükleniyor</main></body></html>'
  }));
  await page.goto(DEFAULT_SHOP_URL);
  await runPageCommand(extensionWorker, "SHOW_CONVERT_PROMPT");
  await expect(page.locator(".ccp-page-prompt")).toHaveCount(0);

  await page.locator("#catalog").evaluate(element => {
    element.innerHTML = '<p class="price">Kadın Elbise 1.250,00 TL</p>';
  });

  await expect(page.locator(".ccp-page-prompt")).toBeVisible();
  await expect(page.locator(".ccp-page-prompt-rate")).toHaveText(/^1 TRY = 0\.0200 EUR/);
});
