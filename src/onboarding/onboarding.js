(function initializeOnboardingPage(global) {
  const api = global.ExtensionAPI;
  const messages = global.CurrencyMessages;
  const I18n = global.CurrencyI18n;
  const t = I18n.t;

  const currencySelect = document.getElementById("homeCurrency");
  const languageSelect = document.getElementById("language");
  const currencyNote = document.getElementById("currencyNote");
  const activateButton = document.getElementById("activateTabs");
  const tabsNote = document.getElementById("tabsNote");
  const finishButton = document.getElementById("finish");
  const doneNote = document.getElementById("doneNote");
  const factThreeBody = document.getElementById("fact3Body");
  const helpNote = document.getElementById("helpNote");
  const helpLink = document.getElementById("helpLink");

  let currencyNames = null;
  let currencyDetails = new Map();
  let currencyCodes = [];
  let selectedCurrency = null;
  // Each note remembers what it says, not just the words, so a language change
  // can say the same thing again in the new language.
  const noteContent = new Map();

  applyLanguage("auto");
  start();

  async function start() {
    activateButton.addEventListener("click", activateOpenTabs);
    finishButton.addEventListener("click", finish);
    currencySelect.addEventListener("change", saveHomeCurrency);
    languageSelect.addEventListener("change", saveLanguage);
    await loadCurrencies();
  }

  function applyLanguage(preference) {
    I18n.setLanguage(preference);
    currencyNames = createCurrencyNames();
    I18n.apply();
    languageSelect.replaceChildren(...I18n.languageOptions().map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }));
    languageSelect.value = preference;
    factThreeBody.replaceChildren(...I18n.nodes("onboarding.fact3Body", {
      code: Object.assign(document.createElement("code"), { textContent: "USD" })
    }));
    const link = helpLink.cloneNode(false);
    link.textContent = t("onboarding.helpLink");
    helpNote.replaceChildren(...I18n.nodes("onboarding.helpNote", { link }));
    renderCurrencyOptions();
    for (const [element, content] of noteContent) renderNote(element, content);
  }

  function createCurrencyNames() {
    try {
      return new Intl.DisplayNames([I18n.language()], { type: "currency" });
    } catch (_error) {
      // A browser without currency display names still gets plain ISO codes.
      return null;
    }
  }

  async function loadCurrencies() {
    const [catalog, settings] = await Promise.all([
      send({ type: messages.GET_CURRENCIES }),
      send({ type: messages.GET_SETTINGS })
    ]);

    const language = settings?.settings?.language;
    if (language && language !== languageSelect.value) applyLanguage(language);
    languageSelect.disabled = !settings?.ok;

    if (!catalog?.ok || !Array.isArray(catalog.currencies) || !catalog.currencies.length) {
      setNoteText(currencyNote, catalog?.error || t("onboarding.currenciesFailed"), "error");
      return;
    }

    selectedCurrency = settings?.settings?.toCurrency;
    currencyDetails = new Map((catalog.details || []).map((currency) => [currency.code, currency]));
    currencyCodes = catalog.currencies;
    renderCurrencyOptions();
    currencySelect.disabled = false;

    // initializeDefaults() already guessed from the browser's region. Saying so
    // turns a silent default into a decision the user can confirm or correct.
    if (selectedCurrency) {
      setNote(currencyNote, "onboarding.currencyGuessed", { currency: () => describe(selectedCurrency) });
    } else {
      setNote(currencyNote, "onboarding.currencyChoose");
    }
  }

  function renderCurrencyOptions() {
    if (!currencyCodes.length) return;
    currencySelect.replaceChildren(...currencyCodes.map((code) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = describe(code);
      option.selected = code === selectedCurrency;
      return option;
    }));
  }

  async function saveLanguage() {
    const language = languageSelect.value;
    applyLanguage(language);
    languageSelect.disabled = true;
    const result = await send({ type: messages.UPDATE_SETTINGS, payload: { language } });
    languageSelect.disabled = false;
    if (!result?.ok) {
      setNoteText(currencyNote, result?.error || t("onboarding.languageFailed"), "error");
    }
  }

  async function saveHomeCurrency() {
    const toCurrency = currencySelect.value;
    currencySelect.disabled = true;
    const result = await send({ type: messages.UPDATE_SETTINGS, payload: { toCurrency } });
    currencySelect.disabled = false;

    if (!result?.ok) {
      setNoteText(currencyNote, result?.error || t("onboarding.currencyFailed"), "error");
      if (result?.settings?.toCurrency) {
        selectedCurrency = result.settings.toCurrency;
        currencySelect.value = selectedCurrency;
      }
      return;
    }
    selectedCurrency = toCurrency;
    setNote(currencyNote, "onboarding.currencySaved", { currency: () => describe(toCurrency) }, "ok");
  }

  async function activateOpenTabs() {
    activateButton.disabled = true;
    setNote(tabsNote, "onboarding.tabsAllow");
    try {
      // Keep the permission request directly in the button's user gesture.
      const granted = await api.permissions.request({ origins: ["http://*/*", "https://*/*"] });
      if (!granted) {
        setNote(tabsNote, "onboarding.tabsDenied", {}, "error");
        return;
      }
      setNote(tabsNote, "onboarding.tabsSwitching");
      const result = await send({ type: messages.ACTIVATE_OPEN_TABS });
      if (!result?.ok) {
        setNoteText(tabsNote, result?.error || t("onboarding.tabsFailed"), "error");
        return;
      }
      summarizeActivation(result);
    } catch (error) {
      setNoteText(
        tabsNote,
        error instanceof Error ? error.message : t("onboarding.tabsPermissionFailed"),
        "error"
      );
    } finally {
      activateButton.disabled = false;
    }
  }

  function summarizeActivation({ activated = 0, skipped = 0 }) {
    if (!activated && !skipped) return setNote(tabsNote, "onboarding.tabsNone", {}, "ok");
    if (!activated) return setNote(tabsNote, "onboarding.tabsNoneActivated", {}, "ok");
    // Two sentences with a count each; plural forms differ per count, so they are
    // separate messages joined here rather than one string with two numbers.
    const parts = [{ key: "onboarding.tabsActivated", params: { count: activated } }];
    if (skipped) parts.push({ key: "onboarding.tabsSkipped", params: { count: skipped } });
    return setNoteParts(tabsNote, parts, "ok");
  }

  async function finish() {
    try {
      const tab = await api.tabs.getCurrent();
      if (tab?.id) {
        await api.tabs.remove(tab.id);
        return;
      }
    } catch (_error) {
      // Closing our own tab is a convenience, never a requirement.
    }
    setNote(doneNote, "onboarding.done", {}, "ok");
  }

  function describe(code) {
    // The rate provider names currencies in English only, so another language
    // asks the browser for a native name first and keeps the provider's as backup.
    const native = I18n.language() === "en" ? null : displayName(code);
    let name = native || currencyDetails.get(code)?.name;
    if (!name || name === code) name = displayName(code);
    return name && name !== code ? `${code} — ${name}` : code;
  }

  function displayName(code) {
    try {
      return currencyNames?.of?.(code) || null;
    } catch (_error) {
      return null;
    }
  }

  // Params may be functions so a note that names a currency can be re-rendered
  // after the language (and therefore the currency's name) changes.
  function renderNote(element, { key, params, parts, text, state }) {
    const resolve = (entries) => Object.fromEntries(Object.entries(entries || {}).map(
      ([name, value]) => [name, typeof value === "function" ? value() : value]
    ));
    if (parts) {
      element.textContent = parts.map((part) => t(part.key, resolve(part.params))).join(" ");
    } else {
      element.textContent = key ? t(key, resolve(params)) : text;
    }
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
  }

  function setNote(element, key, params = {}, state) {
    const content = { key, params, state };
    noteContent.set(element, content);
    renderNote(element, content);
  }

  function setNoteParts(element, parts, state) {
    const content = { parts, state };
    noteContent.set(element, content);
    renderNote(element, content);
  }

  function setNoteText(element, text, state) {
    const content = { text, state };
    noteContent.set(element, content);
    renderNote(element, content);
  }

  async function send(message) {
    try {
      return await api.runtime.sendMessage(message);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
})(globalThis);
