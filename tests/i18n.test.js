const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function createContext(extraGlobals = {}) {
  const context = vm.createContext({ Intl, Object, Array, String, ...extraGlobals });
  for (const file of [
    "shared/settings.js",
    "shared/i18n.js",
    "shared/translations-page.js",
    "shared/translations-app.js"
  ]) {
    vm.runInContext(
      fs.readFileSync(path.join(root, "src", file), "utf8"),
      context,
      { filename: `src/${file}` }
    );
  }
  return context;
}

const context = createContext();
const i18n = context.CurrencyI18n;
const languages = [...i18n.SUPPORTED];
const PLURAL_SUFFIX = /_(?:zero|one|two|few|many|other)$/;

function baseKeys(dictionary) {
  return new Set(Object.keys(dictionary).map((key) => key.replace(PLURAL_SUFFIX, "")));
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

test("the settings schema offers exactly the languages that ship translations", () => {
  assert.deepEqual([...context.CurrencySettings.LANGUAGES], ["auto", ...languages]);
  assert.equal(languages.length, 10, "the add-on promises ten interface languages");
  assert.ok(languages.includes("uk"), "Ukrainian must be one of them");
  for (const language of languages) {
    assert.ok(Object.keys(i18n.dictionary(language)).length > 0, `${language} has no strings`);
  }
});

test("every language translates every English key, keeping its placeholders", () => {
  const english = i18n.dictionary("en");
  const required = baseKeys(english);

  for (const language of languages) {
    const dictionary = i18n.dictionary(language);
    const present = baseKeys(dictionary);
    const missing = [...required].filter((key) => !present.has(key));
    const extra = [...present].filter((key) => !required.has(key));
    assert.deepEqual(missing, [], `${language} is missing strings`);
    assert.deepEqual(extra, [], `${language} has strings English does not`);

    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(typeof value, "string", `${language} ${key}`);
      assert.ok(value.trim(), `${language} ${key} is empty`);
      const reference = english[key] ?? english[`${key.replace(PLURAL_SUFFIX, "")}_other`] ??
        english[key.replace(PLURAL_SUFFIX, "")];
      assert.ok(reference, `${language} ${key} has no English counterpart`);
      // A count that appears in English must appear in every plural form, so
      // that "1 tab" and "5 tabs" never lose their number in translation.
      const expected = placeholders(reference).filter((name) => name !== "count");
      const actual = placeholders(value).filter((name) => name !== "count");
      assert.deepEqual(actual, expected, `${language} ${key} changed its placeholders`);
    }
  }
});

test("languages with several plural forms provide each of them", () => {
  const pluralKeys = [...new Set(
    Object.keys(i18n.dictionary("en"))
      .filter((key) => PLURAL_SUFFIX.test(key) && !key.endsWith("_one"))
      .map((key) => key.replace(PLURAL_SUFFIX, ""))
  )];
  assert.ok(pluralKeys.length > 0);
  for (const language of ["pl", "uk"]) {
    const dictionary = i18n.dictionary(language);
    for (const key of pluralKeys.filter((candidate) => candidate !== "popup.spark.span")) {
      for (const form of ["one", "few", "many", "other"]) {
        assert.ok(dictionary[`${key}_${form}`], `${language} needs ${key}_${form}`);
      }
    }
  }
});

test("every key the source code asks for exists in English", () => {
  const known = baseKeys(i18n.dictionary("en"));
  const files = [
    "popup/popup.js", "popup/popup.html", "popup/settings-controller.js",
    "onboarding/onboarding.js", "onboarding/onboarding.html",
    "content/page-ui.js", "content/content.js", "content/converter.js",
    "shared/page-access.js"
  ];
  const prefixes = /^(popup|onboarding|access|controller|page|toast|error|convert|rate|language)\./;
  const used = new Set();
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, "src", file), "utf8");
    for (const match of source.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) used.add(match[1]);
    for (const match of source.matchAll(/["'`]([a-zA-Z]+\.[a-zA-Z.]+)["'`]/g)) {
      // File names such as popup.css share a prefix with the keys but are not keys.
      if (prefixes.test(match[1]) && !/.(?:js|css|html)$/.test(match[1])) used.add(match[1]);
    }
  }
  // These are built from a variable, so the scan above sees only the prefix.
  for (const direction of ["up", "down", "flat"]) used.add(`popup.spark.${direction}`);

  const unknown = [...used].filter((key) => !known.has(key));
  assert.deepEqual(unknown, [], "source refers to strings that are not translated");
  assert.ok(used.size > 100, "the scan should find the real keys");
});

test("an explicit choice wins; automatic follows the browser and falls back to English", () => {
  const withBrowser = (uiLanguage, languagesList = [], navigatorLanguage = "") => {
    const scoped = createContext({
      ExtensionAPI: { i18n: { getUILanguage: () => uiLanguage } },
      navigator: { languages: languagesList, language: navigatorLanguage }
    });
    return scoped.CurrencyI18n;
  };

  assert.equal(withBrowser("de").resolve("uk"), "uk");
  assert.equal(withBrowser("de").resolve("auto"), "de");
  assert.equal(withBrowser("uk-UA").resolve("auto"), "uk");
  assert.equal(withBrowser("pt-PT").resolve("auto"), "pt-BR");
  assert.equal(withBrowser("xx", ["ja", "it-CH"]).resolve("auto"), "it");
  assert.equal(withBrowser("xx", ["ja"], "zh").resolve("auto"), "en");
  assert.equal(withBrowser("de").resolve("klingon"), "de");
  assert.equal(i18n.matchLanguage("pt_BR"), "pt-BR");
  assert.equal(i18n.matchLanguage("UK"), "uk");
  assert.equal(i18n.matchLanguage("nb"), null);
  assert.equal(i18n.matchLanguage(""), null);
  assert.equal(i18n.matchLanguage(null), null);
});

test("messages fill placeholders and choose the right plural form per language", () => {
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;

  scoped.setLanguage("en");
  assert.equal(scoped.t("popup.converted", { count: 1 }), "Converted 1 price.");
  assert.equal(scoped.t("popup.converted", { count: 3 }), "Converted 3 prices.");
  assert.equal(
    scoped.t("page.prompt.message", { currency: "PLN" }),
    "Convert visible prices on this page to PLN."
  );

  scoped.setLanguage("pl");
  assert.equal(scoped.t("popup.converted", { count: 1 }), "Przeliczono 1 cenę.");
  assert.equal(scoped.t("popup.converted", { count: 3 }), "Przeliczono 3 ceny.");
  assert.equal(scoped.t("popup.converted", { count: 5 }), "Przeliczono 5 cen.");
  assert.equal(scoped.t("popup.converted", { count: 22 }), "Przeliczono 22 ceny.");

  scoped.setLanguage("uk");
  assert.equal(scoped.t("popup.converted", { count: 1 }), "Конвертовано 1 ціну.");
  assert.equal(scoped.t("popup.converted", { count: 2 }), "Конвертовано 2 ціни.");
  assert.equal(scoped.t("popup.converted", { count: 7 }), "Конвертовано 7 цін.");
  assert.equal(scoped.t("popup.converted", { count: 21 }), "Конвертовано 21 ціну.");

  // Turkish has no separate singular here; both counts use the one form it supplies.
  scoped.setLanguage("tr");
  assert.equal(scoped.t("popup.converted", { count: 1 }), "1 fiyat çevrildi.");
  assert.equal(scoped.t("popup.converted", { count: 4 }), "4 fiyat çevrildi.");
});

test("a missing translation falls back to English, and an unknown key shows itself", () => {
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;
  scoped.register("xx", { "popup.amount": "Betrag-xx" });
  scoped.setLanguage("en");
  assert.equal(scoped.t("popup.amount"), "Amount");
  assert.equal(scoped.t("no.such.key"), "no.such.key");
  assert.equal(scoped.t("popup.rateShort", {}), "Rate {date}", "unfilled placeholders stay visible");
});

test("nodes() keeps markup in place while the translator controls word order", () => {
  const marker = { tag: "kbd" };
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;

  scoped.setLanguage("en");
  assert.deepEqual(
    [...scoped.nodes("popup.hint", { shortcut: marker })],
    ["Select a price to convert, or press ", marker, "."]
  );
  scoped.setLanguage("tr");
  assert.deepEqual(
    [...scoped.nodes("popup.hint", { shortcut: marker })],
    ["Çevirmek için bir fiyat seç veya ", marker, " tuşlarına bas."]
  );
});

test("the language menu lists every language by its own name, plus Automatic", () => {
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;
  scoped.setLanguage("uk");
  const options = scoped.languageOptions();
  assert.equal(options[0].value, "auto");
  assert.equal(options[0].label, "Автоматично (мова браузера)");
  assert.deepEqual([...options.slice(1).map((option) => option.value)], languages);
  assert.equal(options.find((option) => option.value === "uk").label, "Українська");
  assert.equal(options.find((option) => option.value === "pt-BR").label, "Português (Brasil)");
});

test("each interface language also has a store listing", () => {
  for (const language of languages) {
    const folder = language.replace("-", "_");
    const file = path.join(root, "src/_locales", folder, "messages.json");
    assert.ok(fs.existsSync(file), `missing store listing for ${language}`);
  }
});
