(function initializeI18n(global) {
  const FALLBACK = "en";
  // Each language names itself in its own tongue so someone who landed on the
  // wrong one can still find theirs. These never need translating.
  const NATIVE_NAMES = Object.freeze({
    en: "English",
    de: "Deutsch",
    es: "Español",
    fr: "Français",
    it: "Italiano",
    nl: "Nederlands",
    pl: "Polski",
    "pt-BR": "Português (Brasil)",
    tr: "Türkçe",
    uk: "Українська"
  });
  const SUPPORTED = Object.freeze(Object.keys(NATIVE_NAMES));
  const dictionaries = new Map();
  let activeLanguage = FALLBACK;
  let pluralRules = createPluralRules(FALLBACK);

  // The translation files call this once per language, so a page that only
  // needs the on-page strings never has to carry the popup's.
  function register(language, entries) {
    dictionaries.set(language, { ...dictionaries.get(language), ...entries });
  }

  function createPluralRules(language) {
    try {
      return new Intl.PluralRules(language);
    } catch (_error) {
      return new Intl.PluralRules(FALLBACK);
    }
  }

  // Maps any BCP 47 tag ("pt", "uk-UA", "de-CH") to a language that has
  // translations, or null when none fits.
  function matchLanguage(tag) {
    if (typeof tag !== "string" || !tag.trim()) return null;
    const normalized = tag.trim().replace(/_/g, "-").toLowerCase();
    const exact = SUPPORTED.find((code) => code.toLowerCase() === normalized);
    if (exact) return exact;
    const primary = normalized.split("-")[0];
    if (primary === "pt") return "pt-BR";
    return SUPPORTED.find((code) => code.toLowerCase() === primary) || null;
  }

  function browserLanguages() {
    const tags = [];
    try {
      tags.push(global.ExtensionAPI?.i18n?.getUILanguage?.());
    } catch (_error) {
      // Some pages cannot reach the extension i18n API; navigator still answers.
    }
    const preferred = global.navigator?.languages;
    if (Array.isArray(preferred)) tags.push(...preferred);
    tags.push(global.navigator?.language);
    return tags;
  }

  function resolve(preference) {
    const explicit = preference && preference !== "auto" ? matchLanguage(preference) : null;
    if (explicit) return explicit;
    for (const tag of browserLanguages()) {
      const match = matchLanguage(tag);
      if (match) return match;
    }
    return FALLBACK;
  }

  function setLanguage(preference) {
    activeLanguage = resolve(preference);
    pluralRules = createPluralRules(activeLanguage);
    return activeLanguage;
  }

  function lookup(key, count) {
    const chain = [dictionaries.get(activeLanguage), dictionaries.get(FALLBACK)];
    const suffixes = count === undefined ? [""] : [`_${pluralRules.select(count)}`, "_other", ""];
    for (const dictionary of chain) {
      if (!dictionary) continue;
      for (const suffix of suffixes) {
        const entry = dictionary[`${key}${suffix}`];
        if (typeof entry === "string") return entry;
      }
    }
    return key;
  }

  function t(key, params = {}) {
    const template = lookup(key, Number.isFinite(params.count) ? params.count : undefined);
    return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
      Object.hasOwn(params, name) ? String(params[name]) : placeholder
    );
  }

  // For strings that wrap markup, such as a sentence around a <kbd> shortcut.
  // Placeholders map to DOM nodes, and word order stays the translator's call.
  function nodes(key, parts = {}) {
    const result = [];
    for (const piece of lookup(key).split(/(\{\w+\})/)) {
      const name = /^\{(\w+)\}$/.exec(piece)?.[1];
      if (name && parts[name]) result.push(parts[name]);
      else if (piece) result.push(piece);
    }
    return result;
  }

  function apply(root = global.document) {
    if (!root?.querySelectorAll) return;
    for (const node of root.querySelectorAll("[data-i18n]")) {
      node.textContent = t(node.dataset.i18n);
    }
    for (const attribute of ["title", "aria-label", "placeholder"]) {
      const dataName = `data-i18n-${attribute}`;
      for (const node of root.querySelectorAll(`[${dataName}]`)) {
        node.setAttribute(attribute, t(node.getAttribute(dataName)));
      }
    }
    if (root === global.document && global.document.documentElement) {
      global.document.documentElement.lang = activeLanguage;
    }
  }

  function languageOptions() {
    return [
      { value: "auto", label: t("language.auto") },
      ...SUPPORTED.map((code) => ({ value: code, label: NATIVE_NAMES[code] }))
    ];
  }

  global.CurrencyI18n = Object.freeze({
    FALLBACK,
    SUPPORTED,
    NATIVE_NAMES,
    register,
    matchLanguage,
    resolve,
    setLanguage,
    language: () => activeLanguage,
    dictionary: (language) => ({ ...dictionaries.get(language) }),
    t,
    nodes,
    apply,
    languageOptions
  });
})(globalThis);
