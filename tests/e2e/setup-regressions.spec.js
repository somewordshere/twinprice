const { test, expect } = require("./fixtures");
const { seedExtension, runPageCommand, DEFAULT_SHOP_URL } = require("./harness");

test("setup uses provider names when the browser only knows currency codes", async ({ context, extensionWorker, extensionId }) => {
  await seedExtension(extensionWorker);
  const names = { XAG: "Silver", XAU: "Gold", XCG: "Caribbean Guilder", XPD: "Palladium", XPT: "Platinum", ZWG: "Zimbabwe Gold" };
  await extensionWorker.evaluate(async names => {
    const { providerCurrencyCatalog: catalog } = await chrome.storage.local.get("providerCurrencyCatalog");
    for (const [code, name] of Object.entries(names)) catalog.currencies.push({ code, name });
    catalog.currencies.sort((a, b) => a.code.localeCompare(b.code));
    await chrome.storage.local.set({ providerCurrencyCatalog: catalog });
  }, names);
  const setup = await context.newPage();
  await setup.addInitScript(() => { Intl.DisplayNames = class { of(code) { return code; } }; });
  await setup.goto(`chrome-extension://${extensionId}/onboarding/onboarding.html`);
  await expect(setup.locator("#homeCurrency")).toBeEnabled();
  for (const [code, name] of Object.entries(names)) {
    await expect(setup.locator(`#homeCurrency option[value='${code}']`)).toHaveText(`${code} — ${name}`);
  }
});

test("setup activates open shops without navigation after site access approval", async ({ context, extensionWorker, extensionId }) => {
  await seedExtension(extensionWorker);
  const shop = await context.newPage();
  // Headless Chromium cannot answer its native optional-permission prompt.
  // Stub only that approval boundary and exercise actual tab discovery and
  // script injection on an origin already granted by the production manifest.
  const url = DEFAULT_SHOP_URL;
  await shop.route(url, route => route.fulfill({ contentType: "text/html", body: "<p>Shop opened before activation</p>" }));
  await shop.goto(url);
  const navigationCount = await shop.evaluate(() => performance.timeOrigin);
  const setup = await context.newPage();
  await setup.addInitScript(() => {
    chrome.permissions.request = async request => {
      window.requestedAccess = request;
      return true;
    };
  });
  await extensionWorker.evaluate(() => { chrome.permissions.contains = async () => true; });
  await setup.goto(`chrome-extension://${extensionId}/onboarding/onboarding.html`);
  await setup.locator("#activateTabs").click();
  await expect(setup.locator("#tabsNote")).toContainText("now watched for prices");
  await expect(setup.locator("#activateTabs")).toBeEnabled();
  expect(await setup.evaluate(() => window.requestedAccess)).toEqual({ origins: ["http://*/*", "https://*/*"] });
  const probe = await extensionWorker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
    if (!tab) return { found: false };
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => Boolean(globalThis.__ccpContentInitialized) });
    return { found: true, initialized: result };
  }, url);
  expect(probe).toEqual({ found: true, initialized: true });
  expect(await shop.evaluate(() => performance.timeOrigin)).toBe(navigationCount);
});

test("setup permits retry after site access is declined", async ({ context, extensionWorker, extensionId }) => {
  await seedExtension(extensionWorker);
  const setup = await context.newPage();
  await setup.addInitScript(() => { chrome.permissions.request = async () => false; });
  await setup.goto(`chrome-extension://${extensionId}/onboarding/onboarding.html`);
  await setup.locator("#activateTabs").click();
  await expect(setup.locator("#tabsNote")).toContainText("Site access was not granted");
  await expect(setup.locator("#activateTabs")).toBeEnabled();
});

test("conversion controls cannot trigger the shop's delegated navigation handlers", async ({ context, extensionWorker }) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", showPagePrompt: true } });
  const shop = await context.newPage();
  await shop.route(DEFAULT_SHOP_URL, route => route.fulfill({ contentType: "text/html", body: `
    <meta itemprop="priceCurrency" content="USD"><p class="price">USD 100.00</p>
    <script>
      window.shopEvents = [];
      for (const type of ['click', 'pointerdown', 'mousedown', 'keydown']) {
        document.addEventListener(type, event => {
          if (!event.target.closest('button')) return;
          window.shopEvents.push(type);
          if (type === 'click') location.hash = 'shop-navigation';
        });
      }
    </script>` }));
  await shop.goto(DEFAULT_SHOP_URL);
  const timeOrigin = await shop.evaluate(() => performance.timeOrigin);
  await shop.locator(".ccp-page-prompt-action").click();
  await expect(shop.locator(".ccp-badge")).toContainText("90,00");
  await shop.locator(".ccp-page-prompt-action").press("Enter");
  await expect(shop.locator(".ccp-badge")).toHaveCount(0);
  await runPageCommand(extensionWorker, "RUN_SITE_CONVERSION");
  await expect(shop.locator(".ccp-badge")).toContainText("90,00");
  await shop.locator(".ccp-toast-action").click();
  await expect(shop.locator(".ccp-badge")).toHaveCount(0);
  expect(await shop.evaluate(() => window.shopEvents)).toEqual([]);
  expect(shop.url()).toBe(DEFAULT_SHOP_URL);
  expect(await shop.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
});
