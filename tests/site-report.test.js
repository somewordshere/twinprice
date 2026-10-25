const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const EXTENSION_BASE = "chrome-extension://mocmiipnkiobjgjkfehpcmlapgjaepfk/";

const context = vm.createContext({ console, Error, Object, Promise, URL, URLSearchParams, JSON });
for (const file of ["shared/page-access.js", "background/site-report.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "src", file), "utf8"), context, {
    filename: `src/${file}`
  });
}

function createReporter({ firefox = false, consent = true, status = 200, failFetch = false } = {}) {
  const requests = [];
  const opened = [];
  const api = {
    runtime: {
      getURL: (relative) => `${EXTENSION_BASE}${relative}`,
      getManifest: () => ({ version: "2.3.4" })
    },
    permissions: { contains: async () => consent },
    windows: { create: async (options) => { opened.push(options); } }
  };
  const service = context.CurrencySiteReport.create({
    api,
    http: {
      fetchWithTimeout: async (url, timeoutMs, init) => {
        requests.push({ url, timeoutMs, init, body: JSON.parse(init.body) });
        if (failFetch) throw new Error("offline");
        return { ok: status >= 200 && status < 300, status };
      }
    },
    pageAccess: { isFirefoxBuild: () => firefox },
    userAgent: "Mozilla/5.0 Chrome/140.0.0.0"
  });
  return { service, requests, opened };
}

const pageSender = { url: "https://shop.example/basket?order=123#pay", tab: { id: 4 } };

test("a report from a page sends only its hostname, never the path or query", async () => {
  const { service, requests } = createReporter();
  const result = await service.report({ reason: "no-prices", to: "EUR", language: "de" }, pageSender);
  assert.deepEqual({ ...result }, { ok: true, site: "shop.example" });
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.url, "https://twinprice.com/api/report");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.credentials, "omit");
  assert.equal(request.init.referrerPolicy, "no-referrer");
  assert.deepEqual(request.body, {
    site: "shop.example",
    reason: "no-prices",
    version: "2.3.4",
    browser: "chrome",
    to: "EUR",
    language: "de"
  });
  assert.doesNotMatch(request.init.body, /basket|order|123|pay/);
});

test("the popup names the page it reports, and an unknown reason becomes failed", async () => {
  const { service, requests } = createReporter();
  await service.report(
    { origin: "https://www.Shop.Example./item/9", reason: "spam" },
    { url: `${EXTENSION_BASE}popup/popup.html` }
  );
  assert.equal(requests[0].body.site, "www.shop.example");
  assert.equal(requests[0].body.reason, "failed");
});

test("pages without a public hostname are not reported", async () => {
  const { service, requests } = createReporter();
  for (const url of [
    "file:///C:/shop.html",
    "http://localhost:8080/",
    "http://192.168.1.10/",
    `${EXTENSION_BASE}popup/popup.html`,
    "not a url"
  ]) {
    const result = await service.report({ reason: "no-prices" }, { url });
    assert.equal(result.ok, false, url);
    assert.equal(result.errorKey, "error.reportPage", url);
  }
  assert.equal(requests.length, 0);
});

test("on Firefox without consent, a page press opens the consent window instead of sending", async () => {
  const { service, requests, opened } = createReporter({ firefox: true, consent: false });
  const result = await service.report({ reason: "no-currency" }, pageSender);
  assert.deepEqual({ ...result }, { ok: false, consentWindow: true });
  assert.equal(requests.length, 0);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].type, "popup");
  assert.equal(
    opened[0].url,
    `${EXTENSION_BASE}popup/report.html?site=shop.example&reason=no-currency`
  );
});

test("on Firefox, a declined prompt in an extension page is reported back, not reopened", async () => {
  const { service, requests, opened } = createReporter({ firefox: true, consent: false });
  const result = await service.report(
    { origin: "https://shop.example", reason: "no-prices" },
    { url: `${EXTENSION_BASE}popup/report.html?site=shop.example` }
  );
  assert.equal(result.ok, false);
  assert.equal(result.errorKey, "error.reportDeclined");
  assert.equal(opened.length, 0);
  assert.equal(requests.length, 0);
});

test("on Firefox with consent, the report goes straight out and says firefox", async () => {
  const { service, requests, opened } = createReporter({ firefox: true, consent: true });
  const result = await service.report({ reason: "no-prices" }, pageSender);
  assert.equal(result.ok, true);
  assert.equal(opened.length, 0);
  assert.equal(requests[0].body.browser, "firefox");
});

test("Firefox asks for the browsing-activity data permission, which the manifest lists as optional", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/firefox.json"), "utf8"));
  const consent = context.CurrencySiteReport.FIREFOX_CONSENT.data_collection;
  assert.deepEqual([...consent], manifest.browser_specific_settings.gecko.data_collection_permissions.optional);
  for (const file of ["src/popup/popup.js", "src/popup/report.js"]) {
    assert.match(
      fs.readFileSync(path.join(root, file), "utf8"),
      /data_collection: \["browsingActivity"\]/,
      `${file} must request the same permission`
    );
  }
});

test("rate limits and failures come back as translatable errors", async () => {
  const limited = await createReporter({ status: 429 }).service.report({ reason: "failed" }, pageSender);
  assert.equal(limited.ok, false);
  assert.equal(limited.errorKey, "error.reportLimited");

  const broken = await createReporter({ status: 502 }).service.report({ reason: "failed" }, pageSender);
  assert.equal(broken.errorKey, "error.reportFailed");

  const offline = await createReporter({ failFetch: true }).service.report({ reason: "failed" }, pageSender);
  assert.equal(offline.errorKey, "error.reportFailed");
});
