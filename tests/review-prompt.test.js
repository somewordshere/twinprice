const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function load(files, extraGlobals = {}) {
  const context = vm.createContext({ console, Error, Object, Promise, Number, ...extraGlobals });
  for (const file of files) {
    vm.runInContext(
      fs.readFileSync(path.join(root, "src", file), "utf8"),
      context,
      { filename: `src/${file}` }
    );
  }
  return context;
}

const context = load(["shared/page-access.js", "background/review-prompt.js"], {
  // The module builds a singleton on load, the way the real background does.
  ExtensionAPI: { runtime: { getManifest: () => ({}) }, storage: { local: {} } }
});
const { REVIEW_URLS, SUCCESSES_BEFORE_ASKING, ASK_ON_PAGE_AT } = context.CurrencyReviewPrompt;

function createPrompt({ stored, firefox = false } = {}) {
  const local = stored === undefined ? {} : { reviewPrompt: stored };
  const openedTabs = [];
  const service = context.CurrencyReviewPrompt.create({
    api: {
      tabs: { create: async (options) => openedTabs.push(options.url) },
      storage: {
        local: {
          get: async (key) => (Object.hasOwn(local, key) ? { [key]: local[key] } : {}),
          set: async (value) => Object.assign(local, value)
        }
      }
    },
    pageAccess: { isFirefoxBuild: () => firefox }
  });
  return { service, local, openedTabs };
}

async function recordTimes(service, times) {
  for (let index = 0; index < times; index += 1) await service.recordSuccess();
}

test("the rating link waits for five pages where a conversion worked", async () => {
  const { service } = createPrompt();
  assert.equal((await service.getState()).show, false);

  await recordTimes(service, SUCCESSES_BEFORE_ASKING - 1);
  assert.equal((await service.getState()).show, false);

  await service.recordSuccess();
  const state = await service.getState();
  assert.equal(state.show, true);
  assert.equal(state.url, REVIEW_URLS.chrome);
});

test("dismissing or opening the rating link hides it for good", async () => {
  for (const choose of ["dismiss", "markRated"]) {
    const { service, local } = createPrompt();
    await recordTimes(service, SUCCESSES_BEFORE_ASKING);
    await service[choose]();
    await recordTimes(service, 3);
    assert.equal((await service.getState()).show, false, choose);
    // Once someone has answered, there is no reason to keep counting.
    assert.equal(local.reviewPrompt.successCount, SUCCESSES_BEFORE_ASKING, choose);
  }
});

test("each package links the store it is published on", async () => {
  const firefox = createPrompt({ firefox: true, stored: { successCount: 9 } });
  assert.deepEqual(
    { ...(await firefox.service.getState()) },
    { ok: true, show: true, url: REVIEW_URLS.firefox }
  );

  // The Chrome package exists only on the Chrome Web Store, so Chrome, Edge,
  // Brave, Opera and Vivaldi all link there.
  const chromium = createPrompt({ stored: { successCount: 9 } });
  assert.deepEqual(
    { ...(await chromium.service.getState()) },
    { ok: true, show: true, url: REVIEW_URLS.chrome }
  );
});

test("the page asks at the 5th, 40th and 100th converted page, and only then", async () => {
  assert.deepEqual([...ASK_ON_PAGE_AT], [5, 40, 100]);
  const { service, local } = createPrompt();
  const askedOn = [];
  for (let page = 1; page <= 150; page += 1) {
    if ((await service.recordSuccess()).askOnPage) askedOn.push(page);
  }
  assert.deepEqual(askedOn, [5, 40, 100]);
  assert.equal(local.reviewPrompt.askedAt, 100);
  // The popup line stays until the user answers, whether or not the page asked.
  assert.equal((await service.getState()).show, true);
});

test("someone already past a milestone is asked once, on the next page that converts", async () => {
  for (const [successCount, askedAt, nextAsk] of [[17, 5, 40], [44, 40, 100], [250, 100, null]]) {
    const { service, local } = createPrompt({ stored: { successCount } });
    assert.equal((await service.recordSuccess()).askOnPage, true, String(successCount));
    assert.equal(local.reviewPrompt.askedAt, askedAt, String(successCount));
    assert.equal((await service.recordSuccess()).askOnPage, false, String(successCount));
    if (nextAsk) {
      local.reviewPrompt.successCount = nextAsk - 1;
      assert.equal((await service.recordSuccess()).askOnPage, true, `${successCount} then ${nextAsk}`);
    }
  }
});

test("an ask at five from before 2.5.4 counts as the first milestone", async () => {
  const { service, local } = createPrompt({ stored: { successCount: 12, askedOnPage: true } });
  assert.equal((await service.recordSuccess()).askOnPage, false);
  assert.equal(local.reviewPrompt.askedAt, 5);
  assert.equal("askedOnPage" in local.reviewPrompt, false, "the old flag is replaced");
  local.reviewPrompt.successCount = 39;
  assert.equal((await service.recordSuccess()).askOnPage, true);
});

test("two tabs reaching the fifth page together ask only once", async () => {
  const { service } = createPrompt({ stored: { successCount: SUCCESSES_BEFORE_ASKING - 1 } });
  const results = await Promise.all([service.recordSuccess(), service.recordSuccess()]);
  assert.equal(results.filter((result) => result.askOnPage).length, 1);
});

test("the page never asks after an answer", async () => {
  for (const stored of [{ successCount: 9, dismissed: true }, { successCount: 9, rated: true }]) {
    const { service } = createPrompt({ stored });
    assert.equal((await service.recordSuccess()).askOnPage, false, JSON.stringify(stored));
  }
});

test("Rate it on a page opens this browser's store and counts as rated", async () => {
  const { service, openedTabs } = createPrompt({ stored: { successCount: 5 } });
  assert.equal((await service.openStore()).ok, true);
  assert.deepEqual(openedTabs, [REVIEW_URLS.chrome]);
  assert.equal((await service.getState()).show, false);

  const firefox = createPrompt({ firefox: true, stored: { successCount: 5 } });
  assert.equal((await firefox.service.openStore()).ok, true);
  assert.deepEqual(firefox.openedTabs, [REVIEW_URLS.firefox]);
});

test("simultaneous successes from several tabs are all counted", async () => {
  const { service, local } = createPrompt();
  await Promise.all(Array.from({ length: 4 }, () => service.recordSuccess()));
  assert.equal(local.reviewPrompt.successCount, 4);
});

test("damaged stored state falls back to a fresh, silent prompt", async () => {
  for (const stored of [null, "yes", { successCount: -3 }, { successCount: "9" }, { successCount: 2.5 }]) {
    const { service } = createPrompt({ stored });
    assert.equal((await service.getState()).show, false, JSON.stringify(stored));
    await service.recordSuccess();
  }
});
