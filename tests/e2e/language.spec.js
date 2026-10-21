const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("./fixtures");
const {
  DEFAULT_SHOP_URL: SHOP_URL,
  chooseSetting,
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

test("the language menu offers thirteen languages and retranslates the popup and the page prompt", async ({
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

  const language = popup.getByRole("combobox", { name: "Language", exact: true });
  await expect(popup.locator("#language")).toHaveValue("auto");
  // Automatic plus thirteen languages, each named in its own tongue.
  await language.click();
  await expect(popup.locator("#languageList [role='option']")).toHaveCount(14);
  await expect(popup.locator("#languageList [data-value='uk']")).toHaveText("Українська");
  await expect(popup.locator("#languageList [data-value='ja']")).toHaveText("日本語");
  await expect(popup.locator("#languageList [data-value='ko']")).toHaveText("한국어");
  await expect(popup.locator("#languageList [data-value='zh-CN']")).toHaveText("简体中文");
  await expect(popup.locator("#convertSite")).toHaveText("Convert page prices");

  await popup.locator("#languageList [data-value='uk']").click();
  await expect(popup.locator("html")).toHaveAttribute("lang", "uk");
  await expect(popup.locator("#convertSite")).toHaveText("Конвертувати ціни на сторінці");
  await expect(popup.locator("summary")).toHaveText("Параметри сторінки");
  await expect(popup.getByRole("combobox", { name: "Мова", exact: true })).toHaveText("Українська");
  await expect(popup.locator("#language")).toHaveValue("uk");
  await expect(popup.locator("#quickConverterTitle")).toHaveText("Конвертувати довільну суму");
  await expect(popup.locator("#hint")).toContainText("Виділіть ціну для конвертації або натисніть");
  await expect(popup.locator("#hint kbd").first()).toBeVisible();
  await expect.poll(() => storedLanguage(extensionWorker)).toBe("uk");

  // The prompt already open on the shop page follows without a reload.
  await expect(shop.locator(".ccp-page-prompt")).toContainText(
    "Конвертувати видимі ціни на цій сторінці"
  );
  await expect(shop.locator(".ccp-page-prompt-action")).toHaveText("Конвертувати ціни");
  // The rate follows the chosen language's decimal mark too.
  await expect(shop.locator(".ccp-page-prompt-rate")).toHaveText(/^1 USD = 0,9000 EUR/);

  // The choice survives closing the popup.
  await popup.close();
  const reopened = await openPopupForPage(context, extensionId, shop);
  await expect(reopened.locator("#popupApp")).toHaveAttribute("aria-busy", "false");
  await expect(reopened.locator("html")).toHaveAttribute("lang", "uk");
  await expect(reopened.locator("#convertSite")).toHaveText("Конвертувати ціни на сторінці");

  await reopened.getByText("Параметри сторінки", { exact: true }).click();
  await chooseSetting(reopened, "Мова", "de");
  await expect(reopened.locator("#convertSite")).toHaveText("Preise der Seite umrechnen");
  await expect(reopened.locator("#hint")).toContainText("Wähle einen Preis zum Umrechnen aus");

  await chooseSetting(reopened, "Sprache", "auto");
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
  await expect(setup.locator("#helpNote a")).toHaveAttribute("href", "https://twinprice.com/uk/#faq");

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

for (const { language, prompt, action, convertPage } of [
  { language: "ja", prompt: "このページに表示されている価格を", action: "価格を換算", convertPage: "ページの価格を換算" },
  { language: "ko", prompt: "이 페이지에 보이는 가격을", action: "가격 환산", convertPage: "페이지 가격 환산" },
  { language: "zh-CN", prompt: "将此页面上可见的价格换算为", action: "换算价格", convertPage: "换算页面价格" }
]) {
  test(`the popup and the page prompt speak ${language} when it is chosen`, async ({
    context,
    extensionWorker,
    extensionId
  }) => {
    await seedExtension(extensionWorker, {
      settings: { fromCurrency: "USD", language, showPagePrompt: true }
    });
    const shop = await openShop(context);
    await expect(shop.locator(".ccp-page-prompt")).toContainText(prompt);
    await expect(shop.locator(".ccp-page-prompt-action")).toHaveText(action);

    const popup = await openPopupForPage(context, extensionId, shop);
    await expect(popup.locator("#popupApp")).toHaveAttribute("aria-busy", "false");
    await expect(popup.locator("html")).toHaveAttribute("lang", language);
    await expect(popup.locator("#convertSite")).toHaveText(convertPage);
  });
}

test("a cached rate says how old it is in the chosen language", async ({
  context,
  extensionWorker,
  extensionId
}) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", language: "de" } });
  // Age the cached USD rates past the 18-hour freshness window and keep the provider
  // unreachable, so every answer comes from the cache.
  await extensionWorker.evaluate(async () => {
    const { ratesCache } = await chrome.storage.local.get("ratesCache");
    ratesCache.bases.USD.fetchedAt = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    await chrome.storage.local.set({ ratesCache });
    const stubbed = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/v2/rates?") && !url.includes("from=")) throw new TypeError("Failed to fetch");
      return stubbed(input, init);
    };
  });
  const shop = await openShop(context);
  const popup = await openPopupForPage(context, extensionId, shop);
  await expect(popup.locator("#popupApp")).toHaveAttribute("aria-busy", "false");

  await expect(popup.locator("#rateMetaText")).toContainText("Zwischengespeichert, 30 Stunden alt");
  await expect(popup.locator("#quickRateInfo")).toContainText("1 USD = 0,9000 EUR");
  await expect(popup.locator("#quickRateInfo")).toHaveAttribute(
    "title",
    /Zwischengespeicherte Kurse werden verwendet \(30 Stunden alt\)/
  );
  await expect(popup.locator("body")).not.toContainText(/hours old|cached rates/i);
});

test("the popup's own links, its site messages and the page prompt follow the chosen language", async ({
  context,
  extensionWorker,
  extensionId
}) => {
  await seedExtension(extensionWorker, {
    settings: { fromCurrency: "USD", language: "ko", showPagePrompt: true }
  });
  const shop = await openShop(context);
  const prompt = shop.locator(".ccp-page-prompt");
  await expect(prompt).toHaveAttribute("lang", "ko");
  // Korean keeps words whole, including inside parts that reset inherited styles.
  await expect(shop.locator(".ccp-page-prompt-message")).toHaveCSS("word-break", "keep-all");

  const popup = await openPopupForPage(context, extensionId, shop);
  await expect(popup.locator("#popupApp")).toHaveAttribute("aria-busy", "false");
  await expect(popup.locator(".brand-link")).toHaveAttribute("href", "https://twinprice.com/ko/");
  await expect(popup.locator(".website-link")).toHaveAttribute("href", "https://twinprice.com/ko/");
  // The test shop runs on the rate provider's own domain, which can never be an
  // automatic site; the background's reason now arrives in Korean.
  await expect(popup.locator("#rememberSiteHelp")).toHaveText(
    "이 환율 제공처에서는 자동 환산을 켤 수 없습니다."
  );

  await popup.getByText("페이지 옵션", { exact: true }).click();
  await chooseSetting(popup, "언어", "en");
  await expect(popup.locator(".brand-link")).toHaveAttribute("href", "https://twinprice.com/");
  await expect(popup.locator("#rememberSiteHelp")).toContainText("cannot be enabled");
});

test("the welcome page fits a phone screen in every language and links to help in that language", async ({
  context,
  extensionWorker,
  extensionId
}) => {
  await seedExtension(extensionWorker, { settings: { language: "en" } });
  const setup = await context.newPage();
  await setup.setViewportSize({ width: 360, height: 800 });
  for (const language of ["en", "es", "fr", "pt-BR", "de", "ja", "ko", "zh-CN"]) {
    await extensionWorker.evaluate((code) => chrome.storage.sync.set({ language: code }), language);
    await setup.goto(`chrome-extension://${extensionId}/onboarding/onboarding.html`);
    await expect(setup.locator("#homeCurrency")).toBeEnabled();
    await expect(setup.locator("html")).toHaveAttribute("lang", language);
    const layout = await setup.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      steps: [...document.querySelectorAll(".step-number")].map((node) => {
        const box = node.getBoundingClientRect();
        return Math.round(box.width) === Math.round(box.height);
      })
    }));
    expect(layout.overflow, `${language} scrolls sideways`).toBeLessThanOrEqual(0);
    expect(layout.steps, `${language} step numbers are not round`).toEqual([true, true]);
    const folder = language === "en" ? "" : `${language}/`;
    await expect(setup.locator("#helpNote a")).toHaveAttribute("href", `https://twinprice.com/${folder}#faq`);
  }
  await expect(setup.locator(".lede")).toHaveCSS("word-break", "normal");
  await extensionWorker.evaluate(() => chrome.storage.sync.set({ language: "ko" }));
  await setup.goto(`chrome-extension://${extensionId}/onboarding/onboarding.html`);
  await expect(setup.locator(".lede")).toHaveCSS("word-break", "keep-all");
});
