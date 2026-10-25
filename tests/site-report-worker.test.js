const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const workerUrl = pathToFileURL(path.resolve(__dirname, "../website/worker.js")).href;
const CHROME_ORIGIN = "chrome-extension://mocmiipnkiobjgjkfehpcmlapgjaepfk";
const FIREFOX_ORIGIN = "moz-extension://0b5e4c2a-7d1f-4e8a-9c3b-2f6a1d9e8b7c";
const REPORT = Object.freeze({
  site: "shop.example",
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

// A stand-in for the GitHub API that records every call and keeps open issues.
function fakeGitHub({ issues = [], fail = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || "GET", headers: init.headers, body: init.body && JSON.parse(init.body) };
    calls.push(call);
    if (fail) return new Response("{}", { status: 500 });
    if (call.url.includes("/search/issues")) {
      return Response.json({ items: issues });
    }
    return Response.json({ number: 7 }, { status: 201 });
  };
  return { calls, fetchImpl };
}

function env(overrides = {}) {
  return { GITHUB_TOKEN: "test-token", GITHUB_REPO: "somewordshere/twinprice", ...overrides };
}

test("a first report for a website opens one labelled GitHub issue with only the report fields", async () => {
  const { handleReport } = await import(workerUrl);
  const github = fakeGitHub();
  const response = await handleReport(request(), env(), github.fetchImpl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), CHROME_ORIGIN);

  assert.equal(github.calls.length, 2);
  const [search, create] = github.calls;
  assert.match(decodeURIComponent(search.url), /repo:somewordshere\/twinprice is:issue is:open label:site-report in:title "Site report: shop\.example"/);
  assert.equal(create.method, "POST");
  assert.equal(create.url, "https://api.github.com/repos/somewordshere/twinprice/issues");
  assert.equal(create.headers.Authorization, "Bearer test-token");
  assert.equal(create.body.title, "Site report: shop.example");
  assert.deepEqual(create.body.labels, ["site-report"]);
  assert.match(create.body.body, /No prices were found/);
  assert.match(create.body.body, /2\.3\.4 \(chrome\)/);
  assert.match(create.body.body, /\| Target currency \| EUR \|/);
  assert.doesNotMatch(create.body.body, /203\.0\.113\.9/, "the visitor's address never reaches GitHub");
});

test("a later report for the same website adds a comment instead of a second issue", async () => {
  const { handleReport } = await import(workerUrl);
  const github = fakeGitHub({
    issues: [
      { number: 3, title: "Site report: shop.example.org" },
      { number: 5, title: "Site report: shop.example" }
    ]
  });
  const response = await handleReport(
    request({ origin: FIREFOX_ORIGIN, body: { ...REPORT, browser: "firefox", reason: "no-currency" } }),
    env(),
    github.fetchImpl
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), FIREFOX_ORIGIN);
  const comment = github.calls[1];
  assert.equal(comment.url, "https://api.github.com/repos/somewordshere/twinprice/issues/5/comments");
  assert.match(comment.body.body, /^Reported again\./);
  assert.match(comment.body.body, /source currency could not be detected/);
  assert.match(comment.body.body, /\(firefox\)/);
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

test("posts from websites or without an origin are refused before GitHub is called", async () => {
  const { handleReport } = await import(workerUrl);
  for (const origin of ["https://evil.example", null, "chrome-extension://not-an-id"]) {
    const github = fakeGitHub();
    const response = await handleReport(request({ origin }), env(), github.fetchImpl);
    assert.equal(response.status, 403, `origin ${origin}`);
    assert.equal(github.calls.length, 0);
  }
});

test("anything outside the closed report format is refused", async () => {
  const { handleReport, parseReport } = await import(workerUrl);
  const invalid = [
    { ...REPORT, site: "https://shop.example/order/123" },
    { ...REPORT, site: "localhost" },
    { ...REPORT, site: "192.168.0.1" },
    { ...REPORT, site: "shop.example\n@everyone" },
    { ...REPORT, reason: "spam" },
    { ...REPORT, version: "2.3.4; DROP" },
    { ...REPORT, browser: "safari" },
    { ...REPORT, site: undefined }
  ];
  for (const body of invalid) assert.equal(parseReport(body), null, JSON.stringify(body));
  assert.deepEqual(
    parseReport({ ...REPORT, site: "Shop.Example", to: "eur", language: "<b>" }),
    { ...REPORT, to: null, language: null },
    "optional fields that do not fit are dropped, and the hostname is lower-cased"
  );
  assert.deepEqual(parseReport({ ...REPORT, language: "pt-BR" }).language, "pt-BR");

  const github = fakeGitHub();
  const notJson = await handleReport(request({ body: "not json" }), env(), github.fetchImpl);
  assert.equal(notJson.status, 400);
  const tooLarge = await handleReport(request({ body: { ...REPORT, padding: "x".repeat(2000) } }), env(), github.fetchImpl);
  assert.equal(tooLarge.status, 400);
  assert.equal(github.calls.length, 0);
});

test("the rate limit is keyed by visitor and stops a report before GitHub", async () => {
  const { handleReport } = await import(workerUrl);
  const keys = [];
  const limiter = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  const github = fakeGitHub();
  const response = await handleReport(request(), env({ REPORT_LIMITER: limiter }), github.fetchImpl);
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { ok: false, error: "rate-limited" });
  assert.deepEqual(keys, ["203.0.113.9"]);
  assert.equal(github.calls.length, 0);
});

test("a GitHub failure or a missing token is reported as unavailable", async () => {
  const { handleReport } = await import(workerUrl);
  const originalError = console.error;
  console.error = () => {};
  try {
    const failing = await handleReport(request(), env(), fakeGitHub({ fail: true }).fetchImpl);
    assert.equal(failing.status, 502);
    assert.deepEqual(await failing.json(), { ok: false, error: "unavailable" });
  } finally {
    console.error = originalError;
  }
  const missing = await handleReport(request(), env({ GITHUB_TOKEN: "" }), fakeGitHub().fetchImpl);
  assert.equal(missing.status, 503);
});

test("a live version that lost GITHUB_REPO still files to the extension's repository", async () => {
  const { handleReport } = await import(workerUrl);
  for (const repo of [undefined, ""]) {
    const github = fakeGitHub();
    const response = await handleReport(request(), env({ GITHUB_REPO: repo }), github.fetchImpl);
    assert.equal(response.status, 200, `GITHUB_REPO ${JSON.stringify(repo)}`);
    const [search, create] = github.calls;
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
