const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const workerUrl = pathToFileURL(path.resolve(__dirname, "../website/worker.js")).href;
const CHROME_ORIGIN = "chrome-extension://mocmiipnkiobjgjkfehpcmlapgjaepfk";
const FIREFOX_ORIGIN = "moz-extension://0b5e4c2a-7d1f-4e8a-9c3b-2f6a1d9e8b7c";
const REPORT = Object.freeze({
  site: "shop.example.com",
  reason: "no-prices",
  version: "2.3.4",
  browser: "chrome",
  to: "EUR",
  language: "de"
});

function request({ method = "POST", origin = CHROME_ORIGIN, body = REPORT, ip = "203.0.113.9" } = {}) {
  const headers = { "Content-Type": "application/json", "CF-Connecting-IP": ip };
  if (origin) headers.Origin = origin;
  return new Request("https://twinprice.com/api/report", {
    method,
    headers,
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined
  });
}

// A stand-in for public DNS and the GitHub API that records every call. `dns`
// maps a record type to the addresses public DNS returns; `recent` is how many
// site-report issues GitHub counts in the last hour.
function fakeServices({ issues = [], fail = false, dns = { A: ["93.184.215.14"] }, dnsStatus = 200, recent = 0 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || "GET", headers: init.headers, body: init.body && JSON.parse(init.body) };
    calls.push(call);
    if (call.url.startsWith("https://cloudflare-dns.com/")) {
      if (dnsStatus !== 200) return new Response("{}", { status: dnsStatus });
      const type = new URL(call.url).searchParams.get("type");
      const code = type === "A" ? 1 : 28;
      return Response.json({
        Status: 0,
        Answer: (dns[type] || []).map((data) => ({ type: code, data }))
      });
    }
    if (fail) return new Response("{}", { status: 500 });
    if (call.url.includes("/search/issues")) {
      const query = decodeURIComponent(new URL(call.url).searchParams.get("q"));
      if (query.includes("created:>=")) return Response.json({ total_count: recent, items: [] });
      return Response.json({ items: issues });
    }
    return Response.json({ number: 7 }, { status: 201 });
  };
  const github = () => calls.filter((call) => call.url.startsWith("https://api.github.com/"));
  const dnsCalls = () => calls.filter((call) => call.url.startsWith("https://cloudflare-dns.com/"));
  return { calls, github, dnsCalls, fetchImpl };
}

function env(overrides = {}) {
  return { GITHUB_TOKEN: "test-token", GITHUB_REPO: "somewordshere/twinprice", ...overrides };
}

test("a first report for a website opens one labelled GitHub issue with only the report fields", async () => {
  const { handleReport } = await import(workerUrl);
  const services = fakeServices();
  const response = await handleReport(request(), env(), services.fetchImpl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), CHROME_ORIGIN);

  const [search, count, create] = services.github();
  assert.equal(services.github().length, 3);
  assert.match(decodeURIComponent(search.url), /repo:somewordshere\/twinprice is:issue is:open label:site-report in:title "Site report: shop\.example\.com"/);
  assert.match(decodeURIComponent(count.url), /repo:somewordshere\/twinprice is:issue label:site-report created:>=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/);
  assert.equal(create.method, "POST");
  assert.equal(create.url, "https://api.github.com/repos/somewordshere/twinprice/issues");
  assert.equal(create.headers.Authorization, "Bearer test-token");
  assert.equal(create.body.title, "Site report: shop.example.com");
  assert.deepEqual(create.body.labels, ["site-report"]);
  assert.match(create.body.body, /No prices were found/);
  assert.match(create.body.body, /2\.3\.4 \(chrome\)/);
  assert.match(create.body.body, /\| Target currency \| EUR \|/);
  assert.doesNotMatch(create.body.body, /203\.0\.113\.9/, "the visitor's address never reaches GitHub");
  assert.match(services.dnsCalls()[0].url, /^https:\/\/cloudflare-dns\.com\/dns-query\?name=shop\.example\.com&type=A$/);
});

test("a later report for the same website adds a comment instead of a second issue", async () => {
  const { handleReport } = await import(workerUrl);
  const services = fakeServices({
    issues: [
      { number: 3, title: "Site report: shop.example.com.au" },
      { number: 5, title: "Site report: shop.example.com" }
    ]
  });
  const response = await handleReport(
    request({ origin: FIREFOX_ORIGIN, body: { ...REPORT, browser: "firefox", reason: "no-currency" } }),
    env(),
    services.fetchImpl
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), FIREFOX_ORIGIN);
  const calls = services.github();
  assert.equal(calls.length, 2, "an existing issue does not count against the hourly cap");
  const comment = calls[1];
  assert.equal(comment.url, "https://api.github.com/repos/somewordshere/twinprice/issues/5/comments");
  assert.match(comment.body.body, /^Reported again\./);
  assert.match(comment.body.body, /source currency could not be detected/);
  assert.match(comment.body.body, /\(firefox\)/);
});

test("names that only exist inside a private network are never published", async () => {
  const { handleReport, isPrivateName } = await import(workerUrl);
  for (const site of [
    "hr.intranet", "nas.local", "jira.corp", "printer.lan", "router.home.arpa", "app.internal",
    "shop.localhost", "shop.example", "build.test", "wiki.private", "files.localdomain"
  ]) {
    assert.equal(isPrivateName(site), true, site);
    const services = fakeServices();
    const response = await handleReport(request({ body: { ...REPORT, site } }), env(), services.fetchImpl);
    assert.equal(response.status, 400, site);
    assert.deepEqual(await response.json(), { ok: false, error: "not-public" });
    assert.equal(services.calls.length, 0, `${site} is refused before any lookup`);
  }
  assert.equal(isPrivateName("shop.example.com"), false);
  assert.equal(isPrivateName("corp.example.com"), false, "only the final label counts");
});

test("a name that public DNS does not know, or that points only at private addresses, is refused", async () => {
  const { handleReport } = await import(workerUrl);
  const cases = [
    { label: "no records", dns: {} },
    { label: "intranet published in public DNS", dns: { A: ["10.1.2.3", "192.168.0.8"], AAAA: ["fd00::5"] } },
    { label: "loopback and link-local", dns: { A: ["127.0.0.1", "169.254.1.1"], AAAA: ["::1", "fe80::1"] } },
    { label: "shared and benchmark ranges", dns: { A: ["100.64.0.1", "172.20.0.1", "198.18.0.1"] } }
  ];
  for (const { label, dns } of cases) {
    const services = fakeServices({ dns });
    const response = await handleReport(request(), env(), services.fetchImpl);
    assert.equal(response.status, 400, label);
    assert.deepEqual(await response.json(), { ok: false, error: "not-public" }, label);
    assert.equal(services.github().length, 0, `${label}: GitHub is never called`);
  }

  // One public address is enough, and IPv6 alone is fine.
  const ipv6 = fakeServices({ dns: { AAAA: ["2606:4700::6810:84e5"] } });
  assert.equal((await handleReport(request(), env(), ipv6.fetchImpl)).status, 200);
  const mixed = fakeServices({ dns: { A: ["10.0.0.1", "104.16.132.229"] } });
  assert.equal((await handleReport(request(), env(), mixed.fetchImpl)).status, 200);
});

test("a DNS outage refuses the report instead of publishing an unchecked name", async () => {
  const { handleReport } = await import(workerUrl);
  const originalError = console.error;
  console.error = () => {};
  try {
    const services = fakeServices({ dnsStatus: 503 });
    const response = await handleReport(request(), env(), services.fetchImpl);
    assert.equal(response.status, 502);
    assert.equal(services.github().length, 0);
  } finally {
    console.error = originalError;
  }
});

test("public and private addresses are told apart", async () => {
  const { isPublicAddress } = await import(workerUrl);
  for (const address of ["93.184.215.14", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::1", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of [
    "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "198.18.0.1", "224.0.0.1", "::", "::1", "fc00::1", "fd12::1", "fe80::1", "ff02::1",
    "::ffff:10.0.0.1", "not an address", undefined
  ]) {
    assert.equal(isPublicAddress(address), false, String(address));
  }
});

test("past the hourly cap, a report that would open a new issue is refused", async () => {
  const { handleReport } = await import(workerUrl);
  const full = fakeServices({ recent: 20 });
  const refused = await handleReport(request(), env(), full.fetchImpl);
  assert.equal(refused.status, 429);
  assert.deepEqual(await refused.json(), { ok: false, error: "rate-limited" });
  assert.equal(full.github().filter((call) => call.method === "POST").length, 0, "no issue is opened");

  // A website that already has an open issue still gets its comment.
  const existing = fakeServices({ recent: 50, issues: [{ number: 5, title: "Site report: shop.example.com" }] });
  assert.equal((await handleReport(request(), env(), existing.fetchImpl)).status, 200);

  const room = fakeServices({ recent: 19 });
  assert.equal((await handleReport(request(), env(), room.fetchImpl)).status, 200);
});

test("the preflight answers extension origins only", async () => {
  const { handleReport } = await import(workerUrl);
  const allowed = await handleReport(request({ method: "OPTIONS" }), env());
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), CHROME_ORIGIN);
  assert.equal(allowed.headers.get("Access-Control-Allow-Methods"), "POST");

  const website = await handleReport(request({ method: "OPTIONS", origin: "https://evil.example" }), env());
  assert.equal(website.status, 403);
  assert.equal(website.headers.get("Access-Control-Allow-Origin"), null);
});

test("posts from websites or without an origin are refused before anything is looked up", async () => {
  const { handleReport } = await import(workerUrl);
  for (const origin of ["https://evil.example", null, "chrome-extension://not-an-id"]) {
    const services = fakeServices();
    const response = await handleReport(request({ origin }), env(), services.fetchImpl);
    assert.equal(response.status, 403, `origin ${origin}`);
    assert.equal(services.calls.length, 0);
  }
});

test("anything outside the closed report format is refused", async () => {
  const { handleReport, parseReport } = await import(workerUrl);
  const invalid = [
    { ...REPORT, site: "https://shop.example.com/order/123" },
    { ...REPORT, site: "localhost" },
    { ...REPORT, site: "192.168.0.1" },
    { ...REPORT, site: "shop.example.com\n@everyone" },
    { ...REPORT, reason: "spam" },
    { ...REPORT, version: "2.3.4; DROP" },
    { ...REPORT, browser: "safari" },
    { ...REPORT, site: undefined }
  ];
  for (const body of invalid) assert.equal(parseReport(body), null, JSON.stringify(body));
  assert.deepEqual(
    parseReport({ ...REPORT, site: "Shop.Example.COM", to: "eur", language: "<b>" }),
    { ...REPORT, to: null, language: null },
    "optional fields that do not fit are dropped, and the hostname is lower-cased"
  );
  assert.deepEqual(parseReport({ ...REPORT, language: "pt-BR" }).language, "pt-BR");

  const services = fakeServices();
  const notJson = await handleReport(request({ body: "not json" }), env(), services.fetchImpl);
  assert.equal(notJson.status, 400);
  const tooLarge = await handleReport(request({ body: { ...REPORT, padding: "x".repeat(2000) } }), env(), services.fetchImpl);
  assert.equal(tooLarge.status, 400);
  assert.equal(services.calls.length, 0);
});

test("the rate limit is keyed by visitor and stops a report before anything is looked up", async () => {
  const { handleReport } = await import(workerUrl);
  const keys = [];
  const limiter = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  const services = fakeServices();
  const response = await handleReport(request(), env({ REPORT_LIMITER: limiter }), services.fetchImpl);
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { ok: false, error: "rate-limited" });
  assert.deepEqual(keys, ["203.0.113.9"]);
  assert.equal(services.calls.length, 0);
});

test("a GitHub failure or a missing token is reported as unavailable", async () => {
  const { handleReport } = await import(workerUrl);
  const originalError = console.error;
  console.error = () => {};
  try {
    const failing = await handleReport(request(), env(), fakeServices({ fail: true }).fetchImpl);
    assert.equal(failing.status, 502);
    assert.deepEqual(await failing.json(), { ok: false, error: "unavailable" });
  } finally {
    console.error = originalError;
  }
  const missing = await handleReport(request(), env({ GITHUB_TOKEN: "" }), fakeServices().fetchImpl);
  assert.equal(missing.status, 503);
});

test("a live version that lost GITHUB_REPO still files to the extension's repository", async () => {
  const { handleReport } = await import(workerUrl);
  for (const repo of [undefined, ""]) {
    const services = fakeServices();
    const response = await handleReport(request(), env({ GITHUB_REPO: repo }), services.fetchImpl);
    assert.equal(response.status, 200, `GITHUB_REPO ${JSON.stringify(repo)}`);
    const [search, , create] = services.github();
    assert.match(decodeURIComponent(search.url), /repo:somewordshere\/twinprice /);
    assert.equal(create.url, "https://api.github.com/repos/somewordshere/twinprice/issues");
  }
});

test("only /api/ reaches the Worker's own code; pages come from the assets", async () => {
  const { default: worker } = await import(workerUrl);
  const served = [];
  const assets = { fetch: async (incoming) => { served.push(new URL(incoming.url).pathname); return new Response("page"); } };
  const page = await worker.fetch(new Request("https://twinprice.com/guide/"), { ASSETS: assets });
  assert.equal(await page.text(), "page");
  const unknown = await worker.fetch(new Request("https://twinprice.com/api/other"), { ASSETS: assets });
  assert.equal(unknown.status, 404);
  assert.deepEqual(served, ["/guide/"]);
  const wrongMethod = await worker.fetch(request({ method: "GET" }), { ASSETS: assets });
  assert.equal(wrongMethod.status, 405);
});
