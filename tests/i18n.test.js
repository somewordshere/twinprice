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
  assert.equal(languages.length, 13, "the add-on promises thirteen interface languages");
  for (const language of ["uk", "ja", "ko", "zh-CN"]) {
    assert.ok(languages.includes(language), `${language} must be one of them`);
  }
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
    "popup/report.js", "popup/report.html",
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
  assert.equal(withBrowser("xx", ["sv", "it-CH"]).resolve("auto"), "it");
  assert.equal(withBrowser("xx", ["sv"], "nb").resolve("auto"), "en");
  assert.equal(withBrowser("de").resolve("klingon"), "de");
  assert.equal(withBrowser("ja-JP").resolve("auto"), "ja");
  assert.equal(withBrowser("ko-KR").resolve("auto"), "ko");
  assert.equal(withBrowser("zh-CN").resolve("auto"), "zh-CN");
  assert.equal(i18n.matchLanguage("pt_BR"), "pt-BR");
  assert.equal(i18n.matchLanguage("UK"), "uk");
  assert.equal(i18n.matchLanguage("zh_CN"), "zh-CN");
  // Simplified Chinese is the only Chinese translation, so every Chinese tag uses it.
  for (const tag of ["zh", "zh-Hans", "zh-SG", "zh-TW", "zh-HK", "zh-Hant-TW"]) {
    assert.equal(i18n.matchLanguage(tag), "zh-CN", tag);
  }
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

  // Japanese, Korean and Chinese have one plural form, so they supply only _other.
  scoped.setLanguage("ja");
  assert.equal(scoped.t("popup.converted", { count: 1 }), "1 件の価格を換算しました。");
  scoped.setLanguage("ko");
  assert.equal(scoped.t("popup.converted", { count: 3 }), "가격 3개를 환산했습니다.");
  scoped.setLanguage("zh-CN");
  assert.equal(scoped.t("popup.converted", { count: 1 }), "已换算 1 个价格。");
  assert.equal(
    scoped.t("page.prompt.message", { currency: "CNY" }),
    "将此页面上可见的价格换算为 CNY。"
  );
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
  assert.equal(options.find((option) => option.value === "ja").label, "日本語");
  assert.equal(options.find((option) => option.value === "ko").label, "한국어");
  assert.equal(options.find((option) => option.value === "zh-CN").label, "简体中文");
});

test("each interface language also has a store listing", () => {
  for (const language of languages) {
    const folder = language.replace("-", "_");
    const file = path.join(root, "src/_locales", folder, "messages.json");
    assert.ok(fs.existsSync(file), `missing store listing for ${language}`);
  }
});

test("each interface language names the keyboard shortcut on the browser's shortcuts page", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifests/base.json"), "utf8"));
  assert.equal(manifest.commands["convert-page"].description, "__MSG_commandConvertPage__");
  for (const language of languages) {
    const file = path.join(root, "src/_locales", language.replace("-", "_"), "messages.json");
    const message = JSON.parse(fs.readFileSync(file, "utf8")).commandConvertPage?.message;
    assert.ok(typeof message === "string" && message.trim(), `${language} has no shortcut name`);
  }
});

test("a cached rate's age is worded in every language, never in English", () => {
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;
  const minute = 60 * 1000;
  const ages = [null, 20 * 1000, minute, 5 * minute, 119 * minute, 3 * 60 * minute, 2 * 24 * 60 * minute, 22 * 24 * 60 * minute];
  scoped.setLanguage("en");
  const english = ages.map((age) => scoped.age(age));
  assert.deepEqual(english, [
    "of unknown age", "less than a minute old", "1 minute old", "5 minutes old",
    "119 minutes old", "3 hours old", "2 days old", "22 days old"
  ]);
  for (const language of languages.filter((code) => code !== "en")) {
    scoped.setLanguage(language);
    ages.forEach((age, index) => {
      const worded = scoped.age(age);
      assert.doesNotMatch(worded, /[{}]/, `${language} ${age}`);
      assert.notEqual(worded, english[index], `${language} ${age} is still English`);
    });
  }
  scoped.setLanguage("pl");
  assert.deepEqual([2, 3, 5, 22].map((hours) => scoped.age(hours * 60 * minute)),
    ["2 godziny temu", "3 godziny temu", "5 godzin temu", "22 godziny temu"]);
  scoped.setLanguage("uk");
  assert.deepEqual([2, 3, 5, 21].map((hours) => scoped.age(hours * 60 * minute)),
    ["2 години тому", "3 години тому", "5 годин тому", "21 годину тому"]);
});

test("background replies are shown in the page's language, with the English kept as a fallback", () => {
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;
  const reply = {
    ok: false,
    error: "Live rates are unavailable and the cached rates are 9 days old. Refusing to use rates older than 7 days.",
    errorKey: "rate.errorTooOld",
    errorParams: { ageMs: 9 * 24 * 60 * 60 * 1000 }
  };
  scoped.setLanguage("de");
  assert.equal(
    scoped.localize(reply).error,
    "Aktuelle Kurse sind nicht verfügbar, und die zwischengespeicherten Kurse sind zu alt (9 Tage alt). " +
      "Kurse, die älter als 7 Tage sind, werden nicht verwendet."
  );
  assert.equal(scoped.localize(reply).errorKey, "rate.errorTooOld", "the reply itself is not changed");
  assert.equal(reply.error.startsWith("Live rates"), true);
  scoped.setLanguage("ja");
  assert.equal(
    scoped.localize({ ok: false, error: "x", errorKey: "error.targetMatchesSite", errorParams: { currency: "PLN", host: "shop.pl" } }).error,
    "換算先の通貨 PLN が shop.pl に保存された換算元の通貨と同じです。先にそのサイトの換算元を変更してください。"
  );
  // An unknown key or a reply without one keeps the English the background sent.
  assert.equal(scoped.localize({ ok: false, error: "Raw", errorKey: "error.noSuchKey" }).error, "Raw");
  assert.equal(scoped.localize({ ok: false, error: "Raw" }).error, "Raw");
  assert.equal(scoped.localize(null), null);
});

test("every key the background sends exists in English, and page-shown keys load on pages", () => {
  const known = baseKeys(i18n.dictionary("en"));
  const pageContext = vm.createContext({ Intl, Object, Array, String });
  for (const file of ["shared/i18n.js", "shared/translations-page.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "src", file), "utf8"), pageContext);
  }
  const pageKeys = baseKeys(pageContext.CurrencyI18n.dictionary("en"));
  const sources = [
    ...fs.readdirSync(path.join(root, "src/background")).map((name) => `background/${name}`),
    "shared/page-access.js"
  ].map((file) => fs.readFileSync(path.join(root, "src", file), "utf8")).join("\n");
  const sent = new Set([...sources.matchAll(/"((?:error|rate|popup|onboarding|convert|access)\.[A-Za-z.]+)"/g)]
    .map((match) => match[1])
    // File names such as onboarding.js share a prefix with the keys but are not keys.
    .filter((key) => !/\.(?:js|html|css)$/.test(key)));
  assert.ok(sent.size >= 25, `the scan should find the background's keys (found ${sent.size})`);
  assert.deepEqual([...sent].filter((key) => !known.has(key)), [], "background keys missing from English");
  // Rate problems are also shown by the on-page prompt, which loads only the page strings.
  const rateKeys = [...sent].filter((key) => key.startsWith("rate.") || key === "convert.ratesFailed");
  assert.deepEqual(rateKeys.filter((key) => !pageKeys.has(key)), [], "rate keys must live in translations-page.js");
});

test("exchange rates and other numbers use the chosen language's decimal mark", () => {
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;
  const cases = { en: ["0.9000", "1490.5", "0.000123"], de: ["0,9000", "1490,5", "0,000123"], ja: ["0.9000", "1490.5", "0.000123"] };
  for (const [language, expected] of Object.entries(cases)) {
    scoped.setLanguage(language);
    assert.deepEqual([0.9, 1490.47, 0.000123].map(scoped.formatRate), expected, language);
  }
  scoped.setLanguage("fr");
  assert.equal(scoped.formatRate(0.9), "0,9000");
  assert.equal(scoped.formatRate(Number.NaN), "—");
  assert.equal(scoped.formatNumber(4.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), "4,50");
});

test("links to twinprice.com open the website in the extension's language", () => {
  const scoped = createContext({ navigator: { languages: [], language: "en" } }).CurrencyI18n;
  assert.equal(scoped.websiteUrl("en"), "https://twinprice.com/");
  assert.equal(scoped.websiteUrl("ja", "#faq"), "https://twinprice.com/ja/#faq");
  assert.equal(scoped.websiteUrl("pt-BR", "goodbye/"), "https://twinprice.com/pt-BR/goodbye/");
  assert.equal(scoped.websiteUrl("zh-TW"), "https://twinprice.com/zh-CN/");
  assert.equal(scoped.websiteUrl("sv"), "https://twinprice.com/");
  scoped.setLanguage("ko");
  assert.equal(scoped.websiteUrl(), "https://twinprice.com/ko/");
  for (const language of languages) {
    const folder = language === "en" ? "" : `${language}/`;
    assert.ok(fs.existsSync(path.join(root, "website/dist", folder, "index.html")), `no website home for ${language}`);
  }
});

test("the website guide quotes the extension's own button and field names in every language", () => {
  // Website text units (website/i18n/<language>.json) and the labels each one quotes.
  const quotes = {
    "2aebc5": ["popup.convertPage", "page.selection.convert"],
    "2b23b1": ["popup.convertPage", "popup.turnOnConvert"],
    "aa7e00": ["page.prompt.convert"],
    "0e41b1": ["popup.pageOptions", "popup.rememberSite"],
    "f1acae": ["popup.restorePrices", "popup.rememberSite"],
    "d0e9d5": ["popup.enable"],
    "9a6b2e": ["popup.amount"],
    "4980f1": ["popup.enable"],
    "a32a04": ["page.selection.convert"],
    "59d5b2": ["page.selection.convert"],
    "27d81a": ["popup.convertPage", "popup.from", "popup.to"],
    "214800": ["popup.from"],
    "92a4a1": ["popup.to"],
    "93a253": ["page.selection.convert"],
    "3985de": ["page.prompt.converting"],
    "1e28aa": ["popup.restorePrices", "popup.pageOptions", "popup.rememberSite", "popup.enable"]
  };
  for (const language of languages) {
    const table = JSON.parse(fs.readFileSync(path.join(root, "website/i18n", `${language}.json`), "utf8"));
    const dictionary = i18n.dictionary(language);
    for (const [unit, keys] of Object.entries(quotes)) {
      assert.ok(table[unit], `website/i18n/${language}.json has no unit ${unit}`);
      for (const key of keys) {
        assert.ok(
          table[unit].toLocaleLowerCase(language).includes(dictionary[key].toLocaleLowerCase(language)),
          `${language} ${unit} should quote ${key} as "${dictionary[key]}"`
        );
      }
    }
  }
});
