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
const { REVIEW_URLS, SUCCESSES_BEFORE_ASKING } = context.CurrencyReviewPrompt;

const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const EDGE_UA = `${CHROME_UA} Edg/140.0.0.0`;

function createPrompt({ stored, firefox = false, userAgent = CHROME_UA } = {}) {
  const local = stored === undefined ? {} : { reviewPrompt: stored };
  const service = context.CurrencyReviewPrompt.create({
    api: {
      storage: {
        local: {
          get: async (key) => (Object.hasOwn(local, key) ? { [key]: local[key] } : {}),
          set: async (value) => Object.assign(local, value)
        }
      }
    },
    pageAccess: { isFirefoxBuild: () => firefox },
    userAgent
  });
  return { service, local };
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

test("each browser gets its own store, and Edge waits for a listing of its own", async () => {
  const firefox = createPrompt({ firefox: true, stored: { successCount: 9 } });
  assert.deepEqual(
    { ...(await firefox.service.getState()) },
    { ok: true, show: true, url: REVIEW_URLS.firefox }
  );

  const edge = createPrompt({ userAgent: EDGE_UA, stored: { successCount: 9 } });
  const edgeState = await edge.service.getState();
  assert.equal(edgeState.show, false);
  assert.equal(edgeState.url, null);
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
