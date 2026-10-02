const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("./fixtures");
const {
  DEFAULT_SHOP_URL: SHOP_URL,
  openPopupForPage,
  seedExtension
} = require("./harness");

const SHOP_HTML = fs.readFileSync(path.resolve(__dirname, "../fixtures/shop.html"), "utf8");

function storedLanguage(extensionWorker) {
  return extensionWorker.evaluate(async () => (await chrome.storage.sync.get("language")).language);
}

async function openShop(context) {
  const shop = await context.newPage();
  await shop.route(SHOP_URL, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: SHOP_HTML
  }));
  await shop.goto(SHOP_URL);
  return shop;
}

test("the language menu offers ten languages and retranslates the popup and the page prompt", async ({
  context,
  extensionWorker,
  extensionId
}) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", showPagePrompt: true } });
  const shop = await openShop(context);
  await expect(shop.locator(".ccp-page-prompt")).toContainText("Convert visible prices");

  const popup = await openPopupForPage(context, extensionId, shop);
  await expect(popup.locator("#popupApp")).toHaveAttribute("aria-busy", "false");
  await popup.getByText("Page options", { exact: true }).click();

  const language = popup.getByLabel("Language", { exact: true });
  await expect(language).toHaveValue("auto");
  // Automatic plus ten languages, each named in its own tongue.
  await expect(language.locator("option")).toHaveCount(11);
  await expect(language.locator("option[value='uk']")).toHaveText("Українська");
  await expect(popup.locator("#convertSite")).toHaveText("Convert page prices");

  await language.selectOption("uk");
  await expect(popup.locator("html")).toHaveAttribute("lang", "uk");
  await expect(popup.locator("#convertSite")).toHaveText("Конвертувати ціни на сторінці");
  await expect(popup.locator("summary")).toHaveText("Параметри сторінки");
  await expect(popup.getByLabel("Мова", { exact: true })).toHaveValue("uk");
  await expect(popup.locator("#quickConverterTitle")).toHaveText("Конвертувати довільну суму");
  await expect(popup.locator("#hint")).toContainText("Виділіть ціну для конвертації або натисніть");
  await expect(popup.locator("#hint kbd").first()).toBeVisible();
  await expect.poll(() => storedLanguage(extensionWorker)).toBe("uk");

  // The prompt already open on the shop page follows without a reload.
  await expect(shop.locator(".ccp-page-prompt")).toContainText(
    "Конвертувати видимі ціни на цій сторінці"
  );
  await expect(shop.locator(".ccp-page-prompt-action")).toHaveText("Конвертувати ціни");
  await expect(shop.locator(".ccp-page-prompt-rate")).toHaveText(/^1 USD = 0\.9000 EUR/);

  // The choice survives closing the popup.
  await popup.close();
  const reopened = await openPopupForPage(context, extensionId, shop);
  await expect(reopened.locator("#popupApp")).toHaveAttribute("aria-busy", "false");
  await expect(reopened.locator("html")).toHaveAttribute("lang", "uk");
  await expect(reopened.locator("#convertSite")).toHaveText("Конвертувати ціни на сторінці");

  await reopened.getByText("Параметри сторінки", { exact: true }).click();
  await reopened.getByLabel("Мова", { exact: true }).selectOption("de");
  await expect(reopened.locator("#convertSite")).toHaveText("Preise der Seite umrechnen");
  await expect(reopened.locator("#hint")).toContainText("Wähle einen Preis zum Umrechnen aus");

  await reopened.getByLabel("Sprache", { exact: true }).selectOption("auto");
  await expect(reopened.locator("#convertSite")).toHaveText("Convert page prices");
  await expect.poll(() => storedLanguage(extensionWorker)).toBe("auto");
});

test("converting a page reports the result in the chosen language", async ({
  context,
  extensionWorker,
  extensionId
}) => {
  await seedExtension(extensionWorker, {
    settings: { fromCurrency: "USD", language: "pl", showPagePrompt: true }
  });
  const shop = await openShop(context);
  await expect(shop.locator(".ccp-page-prompt")).toContainText(
    "Przelicz widoczne ceny na tej stronie"
  );

  await shop.locator(".ccp-page-prompt-action").click();
  await expect(shop.locator(".ccp-page-prompt-action")).toHaveText("Cofnij");
  // Polish has three plural forms, so the noun after the count depends on how many
  // prices the fixture holds.
  await expect(shop.locator(".ccp-page-prompt-message")).toHaveText(
    /^Przeliczono \d+ (?:cenę|ceny|cen) z USD na EUR\.$/
  );

  const popup = await openPopupForPage(context, extensionId, shop);
  await expect(popup.locator("#popupApp")).toHaveAttribute("aria-busy", "false");
  await expect(popup.locator("html")).toHaveAttribute("lang", "pl");
  await expect(popup.locator("#convertSite")).toHaveText("Przelicz ceny na stronie");
});

test("the welcome page follows the saved language and can change it", async ({
  context,
  extensionWorker,
  extensionId
}) => {
  await seedExtension(extensionWorker, { settings: { language: "uk" } });
  const setup = await context.newPage();
  await setup.goto(`chrome-extension://${extensionId}/onboarding/onboarding.html`);

  await expect(setup.locator("#homeCurrency")).toBeEnabled();
  await expect(setup.locator("#language")).toHaveValue("uk");
  await expect(setup.locator("h1")).toHaveText("Два кроки — і готово.");
  await expect(setup.locator("#finish")).toHaveText("Почати покупки");
  await expect(setup.locator("#fact3Body code")).toHaveText("USD");
  await expect(setup.locator("#helpNote a")).toHaveAttribute("href", /twinprice\.com\/#faq/);

  await setup.locator("#language").selectOption("de");
  await expect(setup.locator("h1")).toHaveText("Zwei Schritte, und du bist fertig.");
  await expect(setup.locator("#currencyNote")).toContainText("Eingestellt auf");
  await expect(setup.locator("html")).toHaveAttribute("lang", "de");
  await expect.poll(() => storedLanguage(extensionWorker)).toBe("de");

  // Notes that carry a currency name are re-said in the new language, not left behind.
  await setup.locator("#language").selectOption("en");
  await expect(setup.locator("#currencyNote")).toContainText("guessed from your browser region");
  await expect.poll(() => storedLanguage(extensionWorker)).toBe("en");
});
