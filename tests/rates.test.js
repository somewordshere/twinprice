const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createRateService({ cache, fetchImpl }) {
  const storage = { ratesCache: cache };
  const context = vm.createContext({
    Date,
    Error,
    Object,
    Promise,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: fetchImpl,
    CurrencyCatalog: { CURRENCY_CODES: ["EUR", "USD", "PLN"] },
    CurrencyCatalogService: {
      async getCurrencies() {
        return { currencies: ["EUR", "USD", "PLN"].map((code) => ({ code })) };
      }
    },
    ExtensionAPI: {
      storage: {
        local: {
          async get() { return { ratesCache: storage.ratesCache }; },
          async set(value) { storage.ratesCache = value.ratesCache; }
        }
      }
    }
  });
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../src/background/http.js"), "utf8"),
    context
  );
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../src/background/catalog-snapshot.js"), "utf8"),
    context
  );
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../src/background/rates.js"), "utf8"),
    context
  );
  return { service: context.CurrencyRateService, storage };
}

test("parses Frankfurter v2 rate arrays", () => {
  const { service } = createRateService({ cache: null, fetchImpl: async () => ({ ok: true }) });
  const parsed = service.parseRatesResponse([
    { date: "2026-07-09", base: "EUR", quote: "USD", rate: 1.17 },
    { date: "2026-07-09", base: "EUR", quote: "PLN", rate: 4.25 }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), {
    rates: { USD: 1.17, PLN: 4.25 },
    date: "2026-07-09"
  });
});

function cacheFromDaysAgo(days) {
  return {
    version: 3,
    bases: {
      EUR: {
        fetchedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        rateDate: "2026-07-07",
        rates: { EUR: 1, USD: 1.1, PLN: 4.2 }
      }
    }
  };
}

test("uses recent stale rates with an age warning when the provider is unavailable", async () => {
  const cache = {
    ...cacheFromDaysAgo(3)
  };
  const { service } = createRateService({
    cache,
    fetchImpl: async () => ({ ok: false, status: 503 })
  });
  const result = await service.getRates("EUR");
  assert.equal(result.ok, true);
  assert.equal(result.stale, true);
  assert.equal(result.provider, "Frankfurter");
  assert.match(result.warning, /3 days old/);
  // Pages word the warning in their own language from the key and the age.
  assert.equal(result.warningKey, "rate.warnRefreshing");
  assert.ok(Math.abs(result.warningParams.ageMs - 3 * 24 * 60 * 60 * 1000) < 60 * 1000);
  assert.equal(result.cacheAgeMs, result.warningParams.ageMs);
  assert.equal(Object.hasOwn(result, "cacheAgeLabel"), false, "no English age reaches the pages");
  assert.equal(result.rates.USD, 1.1);
});

// A fresh install fetches its first rates against the built-in currency list. Once
// the provider's catalog arrives the signature differs, and those minutes-old rates
// were served as stale, with a "cached rates … while fresh rates load" warning.
test("refetches young rates saved under another catalog instead of calling them stale", async () => {
  let fetches = 0;
  const { service } = createRateService({
    cache: cacheFromDaysAgo(10 / (24 * 60)),
    fetchImpl: async () => {
      fetches += 1;
      return {
        ok: true,
        status: 200,
        json: async () => [
          { date: "2026-07-08", base: "EUR", quote: "USD", rate: 1.2 },
          { date: "2026-07-08", base: "EUR", quote: "PLN", rate: 4.3 }
        ]
      };
    }
  });
  const result = await service.getRates("EUR");
  assert.equal(fetches, 1);
  assert.equal(result.ok, true);
  assert.equal(result.stale, false);
  assert.equal(result.warning, undefined);
  assert.equal(result.rates.USD, 1.2);
});

test("falls back to young rates from another catalog when the refetch fails", async () => {
  const { service } = createRateService({
    cache: cacheFromDaysAgo(10 / (24 * 60)),
    fetchImpl: async () => ({ ok: false, status: 503 })
  });
  const result = await service.getRates("EUR");
  assert.equal(result.ok, true);
  assert.equal(result.stale, true);
  assert.equal(result.warningKey, "rate.warnLiveUnavailable");
  assert.equal(result.rates.USD, 1.1);
});

test("refuses cached rates older than seven days", async () => {
  const { service } = createRateService({
    cache: cacheFromDaysAgo(8),
    fetchImpl: async () => ({ ok: false, status: 503 })
  });
  const result = await service.getRates("EUR");
  assert.equal(result.ok, false);
  assert.match(result.error, /Refusing to use rates older than 7 days/);
  assert.equal(result.errorKey, "rate.errorTooOld");
  assert.ok(result.errorParams.ageMs > 7 * 24 * 60 * 60 * 1000);
});

test("aborts a rate request after its timeout", async () => {
  const { service } = createRateService({
    cache: null,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("request aborted")), { once: true });
    })
  });
  await assert.rejects(service.fetchWithTimeout("https://example.test", 10), /request aborted/);
});
