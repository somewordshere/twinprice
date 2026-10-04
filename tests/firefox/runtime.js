const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  Browser,
  Builder,
  By,
  until
} = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const { createSeededExtensionState } = require("../helpers/extension-state");

const ROOT = path.resolve(__dirname, "../..");
const FIREFOX_DIST = path.join(ROOT, "dist", "firefox");
const ADDON_ID = "currency-converter-pro@somewordshere";
const ADDON_NAME = "Twinprice";
const SHOP_HTML = fs.readFileSync(path.join(ROOT, "tests", "fixtures", "shop.html"), "utf8");
const FIREFOX_TIMEOUT_MS = 30_000;
const SELECTION_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Selection</title></head>
<body style="font: 28px sans-serif"><p>Folding bike <span id="usd">$100.00</span></p>
<p>Helmet <span id="eur">€89.00</span></p><p>Bell <span id="pln">PLN 49.90</span></p></body></html>`;

test("Firefox page access and popup handlers convert and undo a real webpage", { timeout: 120_000 }, async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ccp-firefox-runtime-"));
  let fixture;
  let driver;
  let installedAddonId;

  try {
    const archivePath = buildTemporaryArchive(temporaryDirectory);
    fixture = await startFixtureServer();
    driver = await createFirefoxDriver();
    await driver.manage().setTimeouts({
      pageLoad: FIREFOX_TIMEOUT_MS,
      script: FIREFOX_TIMEOUT_MS
    });

    installedAddonId = await driver.installAddon(archivePath, true);
    assert.equal(installedAddonId, ADDON_ID);

    const extensionOrigin = await getExtensionOrigin(driver, ADDON_ID);
    await seedExtensionState(driver, extensionOrigin, fixture.url);

    await driver.get(fixture.url);
    await driver.wait(until.elementLocated(By.id("initial")), FIREFOX_TIMEOUT_MS);
    assert.equal(await driver.findElement(By.id("initial")).getText(), "Price: $100.00");
    const shopWindow = await driver.getWindowHandle();
    const popupUrl = `${extensionOrigin}/popup/popup.html`;

    // Firefox's XUL action popup is not exposed as a WebDriver BiDi context, so drive
    // the same popup document in a background tab while the shopping page stays active.
    await driver.switchTo().newWindow("tab");
    await driver.get(popupUrl);
    const popupScript = await driver.getBidi();
    const popupContext = await driver.wait(
      () => findBidiContextByUrl(popupScript, popupUrl),
      FIREFOX_TIMEOUT_MS
    );
    await driver.switchTo().window(shopWindow);
    await navigateBidiContext(popupScript, popupContext.context, popupUrl);

    await waitForPopup(
      driver,
      popupScript,
      popupContext.context,
      "document.querySelector('#fromCurrency').options.length >= 2 && " +
        "document.querySelector('#siteState').title.includes('provider currencies') && " +
        "!document.querySelector('#convertSite').disabled"
    );
    const rememberSiteHelp = await evaluatePopup(
      popupScript,
      popupContext.context,
      "document.querySelector('#rememberSiteHelp').textContent"
    );
    assert.match(rememberSiteHelp, /Converts prices automatically/);
    await evaluatePopup(
      popupScript,
      popupContext.context,
      "document.querySelector('#convertSite').click(); true"
    );

    try {
      await driver.wait(async () => (
        await driver.findElements(By.css("ccp-conversion[data-ccp-owned='true']"))
      ).length === 1, FIREFOX_TIMEOUT_MS);
    } catch (error) {
      const popupDiagnostic = await evaluatePopup(
        popupScript,
        popupContext.context,
        "browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => " +
          "JSON.stringify({ " +
            "status: document.querySelector('#status').textContent, " +
            "statusKind: document.querySelector('#status').dataset.kind, " +
            "activeTab: tabs.map(({ id, url, active }) => ({ id, url, active })) " +
          "}))"
      ).catch(() => "Popup diagnostics unavailable");
      throw new Error(`Firefox popup conversion did not complete. ${popupDiagnostic}`, {
        cause: error
      });
    }

    assert.match(await driver.findElement(By.id("initial")).getText(), /90[.,]00/);
    await waitForPopup(
      driver,
      popupScript,
      popupContext.context,
      "document.querySelector('#clearPage') && !document.querySelector('#clearPage').disabled"
    );
    await evaluatePopup(
      popupScript,
      popupContext.context,
      "document.querySelector('#clearPage').click(); true"
    );

    await driver.wait(async () => (
      await driver.findElements(By.css("ccp-conversion[data-ccp-owned='true']"))
    ).length === 0, FIREFOX_TIMEOUT_MS);
    assert.equal(await driver.findElement(By.id("initial")).getText(), "Price: $100.00");
  } finally {
    if (driver) {
      if (installedAddonId) {
        await driver.uninstallAddon(installedAddonId).catch(() => {});
      }
      await driver.quit().catch(() => {});
    }
    if (fixture) await fixture.close();
    removeTemporaryDirectory(temporaryDirectory);
  }
});

test("Firefox language menu retranslates the popup, the page, and the welcome page", { timeout: 120_000 }, async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ccp-firefox-language-"));
  let fixture;
  let driver;
  let installedAddonId;

  try {
    const archivePath = buildTemporaryArchive(temporaryDirectory);
    fixture = await startFixtureServer();
    driver = await createFirefoxDriver();
    await driver.manage().setTimeouts({
      pageLoad: FIREFOX_TIMEOUT_MS,
      script: FIREFOX_TIMEOUT_MS
    });

    installedAddonId = await driver.installAddon(archivePath, true);
    const extensionOrigin = await getExtensionOrigin(driver, installedAddonId);
    // Start in Polish so the first assertions prove a saved language is honoured.
    await seedExtensionState(driver, extensionOrigin, fixture.url, { language: "pl" });

    await driver.get(fixture.url);
    await driver.wait(until.elementLocated(By.id("initial")), FIREFOX_TIMEOUT_MS);
    const shopWindow = await driver.getWindowHandle();
    const popupUrl = `${extensionOrigin}/popup/popup.html`;

    await driver.switchTo().newWindow("tab");
    await driver.get(popupUrl);
    const bidi = await driver.getBidi();
    const popupContext = await driver.wait(
      () => findBidiContextByUrl(bidi, popupUrl),
      FIREFOX_TIMEOUT_MS
    );
    await driver.switchTo().window(shopWindow);
    await navigateBidiContext(bidi, popupContext.context, popupUrl);
    const popup = (expression) => evaluatePopup(bidi, popupContext.context, expression);

    await waitForPopup(
      driver,
      bidi,
      popupContext.context,
      "document.querySelector('#fromCurrency').options.length >= 2 && " +
        "!document.querySelector('#convertSite').disabled"
    );
    assert.equal(await popup("document.documentElement.lang"), "pl");
    assert.equal(await popup("document.querySelector('#convertSite').textContent"), "Przelicz ceny na stronie");
    assert.equal(await popup("document.querySelector('#language').options.length"), 11);

    // Switch to Ukrainian through the real menu and watch the whole popup follow.
    await popup(
      "(() => { const menu = document.querySelector('#language'); menu.value = 'uk'; " +
        "menu.dispatchEvent(new Event('change', { bubbles: true })); return true; })()"
    );
    await waitForPopup(
      driver,
      bidi,
      popupContext.context,
      "document.documentElement.lang === 'uk' && " +
        "document.querySelector('#convertSite').textContent === 'Конвертувати ціни на сторінці'"
    );
    assert.equal(await popup("document.querySelector('#quickConverterTitle').textContent"), "Конвертувати довільну суму");
    assert.equal(await popup("document.querySelector('#language').selectedOptions[0].textContent"), "Українська");
    assert.match(await popup("document.querySelector('#hint').textContent"), /Виділіть ціну для конвертації/);
    await driver.wait(async () => (
      await popup("browser.storage.sync.get('language').then((stored) => stored.language)")
    ) === "uk", FIREFOX_TIMEOUT_MS);

    // Converting from the popup shows the result on the page in the same language.
    await popup("document.querySelector('#convertSite').click(); true");
    const toast = await driver.wait(
      until.elementLocated(By.css(".ccp-toast-message")),
      FIREFOX_TIMEOUT_MS
    );
    await driver.wait(async () => /^Конвертовано \d+/.test(await toast.getText()), FIREFOX_TIMEOUT_MS);
    assert.equal(await driver.findElement(By.css(".ccp-toast-action")).getText(), "Скасувати");

    // The welcome page reads the saved language and can change it.
    await driver.switchTo().newWindow("tab");
    await driver.get(`${extensionOrigin}/onboarding/onboarding.html`);
    await driver.wait(async () => (
      await driver.findElement(By.id("homeCurrency")).isEnabled()
    ), FIREFOX_TIMEOUT_MS);
    assert.equal(await driver.findElement(By.css("h1")).getText(), "Два кроки — і готово.");
    assert.equal(await driver.findElement(By.id("language")).getAttribute("value"), "uk");
    await driver.executeScript(`
      const menu = document.getElementById("language");
      menu.value = "de";
      menu.dispatchEvent(new Event("change", { bubbles: true }));
    `);
    await driver.wait(async () => (
      await driver.findElement(By.css("h1")).getText()
    ) === "Zwei Schritte, und du bist fertig.", FIREFOX_TIMEOUT_MS);
    assert.match(await driver.findElement(By.id("currencyNote")).getText(), /Eingestellt auf/);
  } finally {
    if (driver) {
      if (installedAddonId) {
        await driver.uninstallAddon(installedAddonId).catch(() => {});
      }
      await driver.quit().catch(() => {});
    }
    if (fixture) await fixture.close();
    removeTemporaryDirectory(temporaryDirectory);
  }
});

test("Firefox selection button, right-click action, and same-currency notice work with a real mouse", { timeout: 180_000 }, async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ccp-firefox-selection-"));
  let fixture;
  let driver;
  let installedAddonId;

  try {
    const archivePath = buildTemporaryArchive(temporaryDirectory);
    fixture = await startFixtureServer();
    driver = await createFirefoxDriver();
    await driver.manage().setTimeouts({
      pageLoad: FIREFOX_TIMEOUT_MS,
      script: FIREFOX_TIMEOUT_MS
    });

    installedAddonId = await driver.installAddon(archivePath, true);
    const extensionOrigin = await getExtensionOrigin(driver, installedAddonId);
    await seedExtensionState(driver, extensionOrigin, fixture.url, {
      showPagePrompt: false,
      fromCurrency: "USD",
      toCurrency: "EUR"
    });
    // The seeding page is an extension page: it can write settings and send the same
    // message the right-click menu sends.
    const extensionTab = await driver.getWindowHandle();
    await driver.switchTo().newWindow("tab");
    const shopTab = await driver.getWindowHandle();
    await driver.get(fixture.selectionUrl);
    await driver.wait(until.elementLocated(By.id("usd")), FIREFOX_TIMEOUT_MS);

    const setSettings = async (settings) => {
      await driver.switchTo().window(extensionTab);
      const error = await driver.executeAsyncScript(`
        const done = arguments[arguments.length - 1];
        browser.storage.sync.set(arguments[0]).then(() => done(null), (e) => done(String(e.message)));
      `, settings);
      assert.equal(error, null, `Could not change settings: ${error}`);
      await driver.switchTo().window(shopTab);
      // The page reloads its settings when storage changes.
      await driver.sleep(1500);
    };
    // The message the right-click menu sends, preceded by the same script check it makes.
    const rightClickAction = async () => {
      await driver.switchTo().window(extensionTab);
      const reply = await driver.executeAsyncScript(`
        const done = arguments[arguments.length - 1];
        (async () => {
          // Match patterns take a host but no port.
          const [tab] = await browser.tabs.query({ url: "http://" + arguments[0] + "/*" });
          const ensure = CurrencyContentScriptResources.createInjector({
            api: ExtensionAPI,
            messages: CurrencyMessages
          });
          await ensure(tab.id);
          return browser.tabs.sendMessage(tab.id, { type: CurrencyMessages.CONVERT_SELECTION });
        })().then(done, (e) => done({ failed: String(e.message) }));
      `, new URL(fixture.selectionUrl).hostname);
      await driver.switchTo().window(shopTab);
      return reply;
    };
    // A real drag across the price, the way a person selects it.
    const dragSelect = async (id) => {
      const box = await driver.executeScript(`
        window.getSelection().removeAllRanges();
        const element = document.getElementById(arguments[0]);
        element.scrollIntoView({ block: "center" });
        const rect = element.getBoundingClientRect();
        return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
      `, id);
      const y = Math.round(box.y + box.h / 2);
      await driver.actions({ async: true })
        .move({ x: Math.round(box.x + 1), y })
        .press()
        .move({ x: Math.round(box.x + box.w - 1), y, duration: 200 })
        .release()
        .perform();
    };
    const popup = async () => (await driver.findElements(By.css(".ccp-selection-popup")))[0];
    // The page script loads its settings asynchronously, so keep selecting until it answers.
    const waitForPopup = (id, matches) => driver.wait(async () => {
      await dragSelect(id);
      await driver.sleep(700);
      const control = await popup();
      return Boolean(control) && matches(control);
    }, 30_000);
    const isButton = async (control) => (await control.getText()) === "Convert selection";
    const isNotice = async (control, currency) => (
      await control.getAttribute("data-state") === "info" &&
      await control.getText() === `This price is already in ${currency}`
    );

    // 1. A price that converts: the button appears for a mouse selection, and clicking it converts.
    await waitForPopup("usd", async (control) => await isButton(control));
    await (await popup()).click();
    await driver.wait(async () => /^USD → /.test(await (await popup())?.getText() ?? ""), FIREFOX_TIMEOUT_MS);

    // 2. The right-click action converts the same selection instead of doing nothing.
    await dragSelect("usd");
    await driver.sleep(500);
    const converted = await rightClickAction();
    assert.equal(converted.ok, true, JSON.stringify(converted));
    assert.equal(converted.sourceCurrency, "USD");
    assert.match(converted.converted, /90/);

    // 3. A price already in the target currency explains itself instead of staying silent.
    await setSettings({ fromCurrency: "AUTO", toCurrency: "EUR" });
    await waitForPopup("eur", async (control) => await isNotice(control, "EUR"));
    assert.equal(await (await popup()).getAttribute("aria-disabled"), "true");
    const sameAsTarget = await rightClickAction();
    assert.equal(sameAsTarget.ok, false);
    assert.equal(
      sameAsTarget.error,
      "This price is already in EUR. Change the target currency to convert it."
    );

    // 4. The same price converts as soon as the target is a different currency.
    await setSettings({ fromCurrency: "AUTO", toCurrency: "USD" });
    await waitForPopup("eur", async (control) => await isButton(control));

    // 5. The same two cases for a price written the way Allegro writes it, with the code first.
    await setSettings({ fromCurrency: "AUTO", toCurrency: "PLN" });
    await waitForPopup("pln", async (control) => await isNotice(control, "PLN"));
    await setSettings({ fromCurrency: "AUTO", toCurrency: "EUR" });
    await waitForPopup("pln", async (control) => await isButton(control));
  } finally {
    if (driver) {
      if (installedAddonId) {
        await driver.uninstallAddon(installedAddonId).catch(() => {});
      }
      await driver.quit().catch(() => {});
    }
    if (fixture) await fixture.close();
    removeTemporaryDirectory(temporaryDirectory);
  }
});

function buildTemporaryArchive(temporaryDirectory) {
  const filename = "twinprice-firefox-runtime.zip";
  const webExtCli = path.join(ROOT, "node_modules", "web-ext", "bin", "web-ext.js");
  const result = spawnSync(process.execPath, [
    webExtCli,
    "build",
    "--source-dir", FIREFOX_DIST,
    "--artifacts-dir", temporaryDirectory,
    "--filename", filename,
    "--overwrite-dest"
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_UPDATE_NOTIFIER: "1" }
  });

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n") || "Could not package the Firefox test add-on."
  );
  const archivePath = path.join(temporaryDirectory, filename);
  assert.ok(fs.existsSync(archivePath), "Firefox test archive was not created.");
  return archivePath;
}

async function startFixtureServer() {
  const server = http.createServer((request, response) => {
    if (request.url === "/test-shop") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(SHOP_HTML);
      return;
    }
    if (request.url === "/selection") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(SELECTION_HTML);
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    url: `http://127.0.0.1:${address.port}/test-shop`,
    selectionUrl: `http://127.0.0.1:${address.port}/selection`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

async function createFirefoxDriver() {
  const options = new firefox.Options();
  options.enableBidi();
  options.windowSize({ width: 1280, height: 900 });
  if (process.env.FIREFOX_HEADLESS !== "0") options.addArguments("-headless");

  const binary = resolveFirefoxBinary();
  if (binary) options.setBinary(binary);

  const service = new firefox.ServiceBuilder(process.env.GECKODRIVER_BIN).addArguments("--allow-system-access");
  return new Builder()
    .forBrowser(Browser.FIREFOX)
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();
}

function resolveFirefoxBinary() {
  if (process.env.FIREFOX_BIN) return path.resolve(process.env.FIREFOX_BIN);
  if (process.platform !== "win32") return null;
  const defaultPath = "C:\\Program Files\\Mozilla Firefox\\firefox.exe";
  return fs.existsSync(defaultPath) ? defaultPath : null;
}

async function getExtensionOrigin(driver, addonId) {
  await driver.setContext(firefox.Context.CHROME);
  try {
    const hostname = await driver.wait(async () => driver.executeScript(`
      const addonId = arguments[0];
      if (typeof WebExtensionPolicy !== "undefined") {
        const policy = WebExtensionPolicy.getByID(addonId);
        if (policy?.mozExtensionHostname) return policy.mozExtensionHostname;
      }
      const services = globalThis.Services ??
        ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs").Services;
      const mapping = JSON.parse(
        services.prefs.getStringPref("extensions.webextensions.uuids", "{}")
      );
      return mapping[addonId] || null;
    `, addonId), FIREFOX_TIMEOUT_MS);
    return `moz-extension://${hostname}`;
  } finally {
    await driver.setContext(firefox.Context.CONTENT);
  }
}

async function seedExtensionState(driver, extensionOrigin, fixtureUrl, settings = {}) {
  await driver.get(`${extensionOrigin}/popup/popup.html`);
  await driver.wait(until.elementLocated(By.id("convertSite")), FIREFOX_TIMEOUT_MS);
  await driver.wait(async () => driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    browser.storage.sync.get("enabled").then(
      (stored) => done(typeof stored.enabled === "boolean"),
      () => done(false)
    );
  `), FIREFOX_TIMEOUT_MS);

  const state = createSeededExtensionState({
    settings: { showPagePrompt: false, ...settings },
    local: {
      siteSourceCurrencies: {
        [new URL(fixtureUrl).origin]: "USD"
      }
    }
  });
  const error = await driver.executeAsyncScript(`
    const state = arguments[0];
    const done = arguments[arguments.length - 1];
    (async () => {
      await browser.storage.sync.set(state.sync);
      await browser.storage.local.set(state.local);
    })().then(() => done(null), (failure) => done(String(failure?.message || failure)));
  `, state);
  assert.equal(error, null, `Could not seed Firefox extension state: ${error}`);
}

async function grantActiveTabFromAction(driver, addonId, addonName) {
  await driver.setContext(firefox.Context.CHROME);
  try {
    let actionButton = await findActionButton(driver, addonId, addonName);
    if (!actionButton) {
      await driver.findElement(By.id("unified-extensions-button")).click();
      actionButton = await driver.wait(
        () => findActionButton(driver, addonId, addonName),
        FIREFOX_TIMEOUT_MS
      );
    }

    await actionButton.click();
    await driver.wait(async () => driver.executeScript(`
      const popupBrowser = [...document.querySelectorAll("browser.webextension-popup-browser")]
        .find((candidate) => candidate.currentURI?.spec?.includes("/popup/popup.html"));
      if (!popupBrowser) return false;
      popupBrowser.closest("panel")?.hidePopup();
      return true;
    `), FIREFOX_TIMEOUT_MS);
  } finally {
    await driver.setContext(firefox.Context.CONTENT);
  }
}

async function findActionButton(driver, addonId, addonName) {
  return driver.executeScript(`
    const addonId = arguments[0];
    const addonName = arguments[1];
    const visible = (node) => Boolean(node && !node.hidden && node.getClientRects().length);
    const direct = [...document.querySelectorAll(".webextension-browser-action[data-extensionid]")]
      .find((node) => node.getAttribute("data-extensionid") === addonId && visible(node));
    if (direct) return direct;

    const item = [...document.querySelectorAll("unified-extensions-item")].find((node) => {
      const name = node.querySelector(".unified-extensions-item-name");
      return node.getAttribute("extension-id") === addonId ||
        node.addon?.id === addonId ||
        node.extension?.id === addonId ||
        name?.value === addonName ||
        name?.textContent?.trim() === addonName;
    });
    const itemAction = item?.querySelector(".unified-extensions-item-action-button");
    return visible(itemAction) ? itemAction : null;
  `, addonId, addonName);
}

async function findBidiContextByUrl(bidi, url) {
  const response = await bidi.send({
    method: "browsingContext.getTree",
    params: {}
  });
  assertBidiSuccess(response, "Could not read Firefox browsing contexts");

  const contexts = [];
  const visit = (context) => {
    contexts.push(context);
    for (const child of context.children || []) visit(child);
  };
  for (const context of response.result?.contexts || []) visit(context);
  return contexts.find((context) => context.parent === null && context.url === url) || null;
}

async function navigateBidiContext(bidi, contextId, url) {
  const response = await bidi.send({
    method: "browsingContext.navigate",
    params: {
      context: contextId,
      url,
      wait: "complete"
    }
  });
  assertBidiSuccess(response, "Could not reload the Firefox popup in the background");
}

async function waitForPopup(driver, bidi, contextId, expression) {
  try {
    await driver.wait(async () => {
      try {
        return await evaluatePopup(bidi, contextId, `Boolean(${expression})`);
      } catch (error) {
        if (!/no such frame|no such window|realm/i.test(error.message)) throw error;
        return false;
      }
    }, FIREFOX_TIMEOUT_MS);
  } catch (error) {
    throw new Error(`Timed out waiting for the Firefox popup: ${expression}`, {
      cause: error
    });
  }
}

async function evaluatePopup(bidi, contextId, expression) {
  const response = await bidi.send({
    method: "script.evaluate",
    params: {
      expression,
      awaitPromise: true,
      target: { context: contextId }
    }
  });
  assertBidiSuccess(response, "Firefox popup script failed");
  const result = response.result;
  if (result?.type !== "success") {
    throw new Error(result?.exceptionDetails?.text || "Firefox popup script failed.");
  }
  return result.result?.value;
}

function assertBidiSuccess(response, fallbackMessage) {
  if (response.type === "error" || response.error) {
    throw new Error(`${response.error || fallbackMessage}: ${response.message || "Unknown BiDi error"}`);
  }
}

function removeTemporaryDirectory(directory) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedTemp = `${path.resolve(os.tmpdir())}${path.sep}`;
  assert.ok(
    resolvedDirectory.startsWith(resolvedTemp),
    `Refusing to remove a non-temporary directory: ${resolvedDirectory}`
  );
  fs.rmSync(resolvedDirectory, { recursive: true, force: true });
}
