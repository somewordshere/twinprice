const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("./fixtures");
const { openPopupForPage, runPageCommand, seedExtension } = require("./harness");

const BROKEN_SHOP_URL = "https://broken-shop.twinprice-fixture.com/basket?order=4417";
// The harness finds a tab by its address, which the extension can read only on a
// site it may access, so this page borrows the rate provider's host.
const EMPTY_SHOP_URL = "https://api.frankfurter.dev/empty-catalog?session=88";
const SHOP_HTML = fs.readFileSync(path.resolve(__dirname, "../fixtures/shop.html"), "utf8");
const EMPTY_HTML = "<!doctype html><html lang=\"en\"><body><h1>Catalog</h1><p>Nothing for sale here today.</p></body></html>";

function serve(page, url, body) {
  return page.route(url, (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body
  }));
}

function reportsSent(extensionWorker) {
  return extensionWorker.evaluate(() => globalThis.__ccpReports || []);
}

test("a failed conversion in the on-page prompt offers a report that sends only the hostname", async ({
  context,
  extensionWorker
}) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD", showPagePrompt: true } });
  const shop = await context.newPage();
  await serve(shop, BROKEN_SHOP_URL, SHOP_HTML);
  await shop.goto(BROKEN_SHOP_URL);

  const prompt = shop.locator(".ccp-page-prompt");
  const report = prompt.locator(".ccp-page-prompt-report");
  await expect(prompt).toBeVisible();
  // Nothing has failed yet, so there is nothing to report.
  await expect(report).toBeHidden();

  // The shop takes its prices away before the press, so the conversion finds none.
  await shop.evaluate(() => {
    for (const node of document.body.querySelectorAll(":scope > :not(.ccp-page-prompt)")) node.remove();
  });
  await prompt.getByRole("button", { name: "Convert prices" }).click();
  await expect(prompt).toHaveAttribute("data-state", "error");
  await expect(report).toBeVisible();
  await expect(report.locator(".ccp-page-prompt-report-note"))
    .toHaveText("Sends only broken-shop.twinprice-fixture.com to twinprice.com.");

  await report.getByRole("button", { name: "Report this website" }).click();
  await expect(report.locator(".ccp-page-prompt-report-note")).toHaveText("Thanks! The website was reported.");
  await expect(report).toHaveAttribute("data-state", "success");
  await expect(report.getByRole("button", { name: "Report this website" })).toBeHidden();

  const reports = await reportsSent(extensionWorker);
  expect(reports).toEqual([{
    site: "broken-shop.twinprice-fixture.com",
    reason: "no-prices",
    version: require("../../package.json").version,
    browser: "chrome",
    to: "EUR",
    language: "en"
  }]);
  expect(JSON.stringify(reports)).not.toContain("basket");
  expect(JSON.stringify(reports)).not.toContain("4417");

  // Failing again offers the button again, but one report per page is enough.
  await prompt.getByRole("button", { name: "Try again" }).click();
  await expect(report.getByRole("button", { name: "Report this website" })).toBeVisible();
  await report.getByRole("button", { name: "Report this website" }).click();
  await expect(report.locator(".ccp-page-prompt-report-note")).toHaveText("Thanks! The website was reported.");
  expect(await reportsSent(extensionWorker)).toHaveLength(1);
});

test("a shortcut conversion that finds nothing offers the report in its notice", async ({
  context,
  extensionWorker
}) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD" } });
  const shop = await context.newPage();
  await serve(shop, EMPTY_SHOP_URL, EMPTY_HTML);
  await shop.goto(EMPTY_SHOP_URL);

  const result = await runPageCommand(extensionWorker, "RUN_SITE_CONVERSION", EMPTY_SHOP_URL);
  expect(result.ok).toBe(false);
  expect(result.reportReason).toBe("no-prices");

  const toast = shop.locator(".ccp-toast");
  await expect(toast).toContainText("Sends only api.frankfurter.dev to twinprice.com.");
  await toast.getByRole("button", { name: "Report this website" }).click();
  await expect(shop.locator(".ccp-toast-message")).toHaveText("Thanks! The website was reported.");
  expect(await reportsSent(extensionWorker)).toEqual([
    expect.objectContaining({ site: "api.frankfurter.dev", reason: "no-prices", browser: "chrome" })
  ]);
});

test("the popup offers a report after converting nothing, and shows a refused report", async ({
  context,
  extensionWorker,
  extensionId
}) => {
  await seedExtension(extensionWorker, { settings: { fromCurrency: "USD" } });
  const shop = await context.newPage();
  await serve(shop, EMPTY_SHOP_URL, EMPTY_HTML);
  await shop.goto(EMPTY_SHOP_URL);

  const popup = await openPopupForPage(context, extensionId, shop);
  const report = popup.locator("#reportSite");
  await expect(report).toBeHidden();
  await popup.getByRole("button", { name: "Convert page prices" }).click();
  await expect(popup.locator("#status")).toContainText("No supported prices found on this page.");
  await expect(report).toBeVisible();
  await expect(popup.locator("#reportSiteNote")).toHaveText("Sends only api.frankfurter.dev to twinprice.com.");

  await extensionWorker.evaluate(() => { globalThis.__ccpReportStatus = 429; });
  await popup.getByRole("button", { name: "Report this website" }).click();
  await expect(popup.locator("#reportSiteNote")).toHaveText("Too many reports in a short time. Try again in a minute.");
  await expect(report).toHaveAttribute("data-state", "error");

  await extensionWorker.evaluate(() => { globalThis.__ccpReportStatus = 200; });
  await popup.getByRole("button", { name: "Report this website" }).click();
  await expect(popup.locator("#reportSiteNote")).toHaveText("Thanks! The website was reported.");
  await expect(popup.getByRole("button", { name: "Report this website" })).toBeHidden();
  const reports = await reportsSent(extensionWorker);
  expect(reports).toHaveLength(2);
  expect(reports[1]).toEqual(expect.objectContaining({ site: "api.frankfurter.dev", reason: "no-prices", to: "EUR" }));
});
