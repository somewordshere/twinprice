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

function createReporter({ firefox = false, consent = true, status = 200, reply = {}, failFetch = false } = {}) {
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
        return { ok: status >= 200 && status < 300, status, json: async () => reply };
      }
    },
    pageAccess: { isFirefoxBuild: () => firefox },
    userAgent: "Mozilla/5.0 Chrome/140.0.0.0"
  });
  return { service, requests, opened };
}

const pageSender = { url: "https://shop.example.com/basket?order=123#pay", tab: { id: 4 } };
const popupSender = { url: `${EXTENSION_BASE}popup/popup.html` };

test("a report from a page sends only its hostname, never the path or query", async () => {
  const { service, requests } = createReporter();
  const result = await service.report({ reason: "no-prices", to: "EUR", language: "de" }, pageSender);
  assert.deepEqual({ ...result }, { ok: true, site: "shop.example.com" });
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.url, "https://twinprice.com/api/report");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.credentials, "omit");
  assert.equal(request.init.referrerPolicy, "no-referrer");
  assert.deepEqual(request.body, {
    site: "shop.example.com",
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
  await service.report({ origin: "https://www.Shop.Example.com./item/9", reason: "spam", openConsent: true }, popupSender);
  assert.equal(requests[0].body.site, "www.shop.example.com");
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

test("names that only exist inside a private network never leave the browser", async () => {
  const { service, requests, opened } = createReporter({ firefox: true, consent: false });
  for (const host of [
    "hr.intranet", "nas.local", "jira.corp", "printer.lan", "router.home.arpa", "app.internal",
    "shop.localhost", "shop.example", "build.test", "wiki.private", "files.localdomain"
  ]) {
    assert.equal(service.hostnameOf(`https://${host}/prices`), null, host);
    const result = await service.report({ reason: "no-prices" }, { url: `https://${host}/prices`, tab: { id: 1 } });
    assert.equal(result.errorKey, "error.reportPage", host);
  }
  assert.equal(requests.length, 0);
  assert.equal(opened.length, 0, "not even Firefox's consent window opens for them");
  assert.equal(service.hostnameOf("https://corp.example.com/"), "corp.example.com", "only the final label counts");
});

test("a name twinprice.com finds no public address for is reported as not reportable", async () => {
  const { service } = createReporter({ status: 400, reply: { ok: false, error: "not-public" } });
  const result = await service.report({ reason: "no-prices" }, pageSender);
  assert.equal(result.ok, false);
  assert.equal(result.errorKey, "error.reportPage");

  const invalid = await createReporter({ status: 400, reply: { ok: false, error: "invalid" } })
    .service.report({ reason: "no-prices" }, pageSender);
  assert.equal(invalid.errorKey, "error.reportFailed");
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
    `${EXTENSION_BASE}popup/report.html?site=shop.example.com&reason=no-currency`
  );
});

test("on Firefox without consent, the popup opens the consent window too instead of prompting itself", async () => {
  const { service, requests, opened } = createReporter({ firefox: true, consent: false });
  const result = await service.report(
    { origin: "https://shop.example.com/cart", reason: "no-prices", openConsent: true },
    popupSender
  );
  assert.deepEqual({ ...result }, { ok: false, consentWindow: true });
  assert.equal(requests.length, 0);
  assert.equal(opened[0].url, `${EXTENSION_BASE}popup/report.html?site=shop.example.com&reason=no-prices`);
});

test("on Firefox, a declined prompt in the consent window is reported back, not reopened", async () => {
  const { service, requests, opened } = createReporter({ firefox: true, consent: false });
  const result = await service.report(
    { origin: "https://shop.example.com", reason: "no-prices" },
    { url: `${EXTENSION_BASE}popup/report.html?site=shop.example.com` }
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

test("only the consent window asks Firefox for the browsing-activity permission the manifest lists as optional", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/firefox.json"), "utf8"));
  const consent = context.CurrencySiteReport.FIREFOX_CONSENT.data_collection;
  assert.deepEqual([...consent], manifest.browser_specific_settings.gecko.data_collection_permissions.optional);
  assert.match(
    fs.readFileSync(path.join(root, "src/popup/report.js"), "utf8"),
    /permissions\.request\(CONSENT\)[\s\S]*data_collection: \["browsingActivity"\]|data_collection: \["browsingActivity"\][\s\S]*permissions\.request\(CONSENT\)/,
    "the consent window must request the same permission"
  );
  const popup = fs.readFileSync(path.join(root, "src/popup/popup.js"), "utf8");
  assert.doesNotMatch(popup, /data_collection/, "the popup leaves the prompt to the consent window");
  assert.match(popup, /type: M\.REPORT_SITE[\s\S]{0,300}openConsent: true/);
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
