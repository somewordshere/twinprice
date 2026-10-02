const enabledInput = document.getElementById("enabled");
const popupAppNode = document.getElementById("popupApp");
const fromCurrencySelect = document.getElementById("fromCurrency");
const toCurrencySelect = document.getElementById("toCurrency");
const fromCurrencySearch = document.getElementById("fromCurrencySearch");
const toCurrencySearch = document.getElementById("toCurrencySearch");
const fromCurrencyList = document.getElementById("fromCurrencyList");
const toCurrencyList = document.getElementById("toCurrencyList");
const swapButton = document.getElementById("swapCurrencies");
const themeSelect = document.getElementById("theme");
const languageSelect = document.getElementById("language");
const hintNode = document.getElementById("hint");
const shortcutNode = document.getElementById("shortcut");
const displayModeSelect = document.getElementById("displayMode");
const convertedTextColorInput = document.getElementById("convertedTextColor");
const convertedTextColorHexInput = document.getElementById("convertedTextColorHex");
const convertedBackgroundColorInput = document.getElementById("convertedBackgroundColor");
const convertedBackgroundColorHexInput = document.getElementById("convertedBackgroundColorHex");
const convertedShapeInputs = [...document.querySelectorAll("input[name='convertedShape']")];
const appearancePreviewNode = document.getElementById("appearancePreview");
const appearanceContrastNode = document.getElementById("appearanceContrast");
const appearanceAnnouncementNode = document.getElementById("appearanceAnnouncement");
const resetAppearanceButton = document.getElementById("resetAppearance");
const showPagePromptInput = document.getElementById("showPagePrompt");
const rememberSiteInput = document.getElementById("rememberSite");
const rememberSiteHelpNode = document.getElementById("rememberSiteHelp");
const convertSiteButton = document.getElementById("convertSite");
const clearPageButton = document.getElementById("clearPage");
const clearSiteButton = document.getElementById("clearSite");
const secondaryActionsNode = document.getElementById("secondaryActions");
const statusContainerNode = document.getElementById("statusContainer");
const statusNode = document.getElementById("status");
const rateInfoNode = document.getElementById("rateInfo");
const siteStateNode = document.getElementById("siteState");
const quickAmountInput = document.getElementById("quickAmount");
const quickResultNode = document.getElementById("quickResult");
const quickRateInfoNode = document.getElementById("quickRateInfo");
const quickConverterNode = document.getElementById("quickConverter");
const pageOptionsNode = document.getElementById("pageOptions");
const quickConverterFieldsNode = document.getElementById("quickConverterFields");
const quickSourceRequiredNode = document.getElementById("quickSourceRequired");
const chooseQuickSourceButton = document.getElementById("chooseQuickSource");
const quickOutputLabelNode = document.getElementById("quickOutputLabel");
const fromCurrencyDiscNode = document.getElementById("fromCurrencyDisc");
const toCurrencyDiscNode = document.getElementById("toCurrencyDisc");
const openPageOptionsButton = document.getElementById("openPageOptions");
const recentPairsNode = document.getElementById("recentPairs");
const rateLineNode = document.getElementById("rateLine");
const rateFromNode = document.getElementById("rateFrom");
const rateToNode = document.getElementById("rateTo");
const rateValueNode = document.getElementById("rateValue");
const rateMetaNode = document.getElementById("rateMeta");
const rateMetaTextNode = document.getElementById("rateMetaText");
const rateSparkNode = document.getElementById("rateSpark");
const rateSparkLineNode = document.getElementById("rateSparkLine");
const rateSparkFillNode = document.getElementById("rateSparkFill");
const rateSparkPointNode = document.getElementById("rateSparkPoint");
const rateSparkTitleNode = document.getElementById("rateSparkTitle");
const reviewPromptNode = document.getElementById("reviewPrompt");
const reviewLinkNode = document.getElementById("reviewLink");
const dismissReviewButton = document.getElementById("dismissReview");
const M = CurrencyMessages;
const I18n = CurrencyI18n;
const t = I18n.t;
let currencyNames = createCurrencyNames();
const ensureContentScripts = CurrencyContentScriptResources.createInjector({
  api: ExtensionAPI,
  messages: M
});
let activeTab = null;
let siteStatus = null;
let lastDetectedCurrency = null;
let currencies = [];
let recentCurrencies = [];
let recentPairs = [];
let currencyDetails = new Map();
let availableQuoteCurrencies = null;
let availableRatesSource = null;
let catalogWarning = null;
let quickConversionTimer = null;
let appearanceAnnouncementTimer = null;
let quickConversionRequestId = 0;
let rateHistoryRequestId = 0;
let renderedHistoryPair = null;
let pageConversionError = null;
let primaryActionBusy = false;
let popupReady = false;
let popupLocked = false;
const settingsController = CurrencyPopupSettingsController.create({
  normalize: CurrencySettings.normalizeSnapshot,
  matches: CurrencySettings.snapshotEquals,
  persist: dispatchSettingsUpdate,
  reload: fetchActualSettings,
  apply: applySettingsToControls,
  status: setStatus,
  lock: lockPopupInteractions,
  onSaved: finalizeSavedSettings,
  reportError: (phase, error) => {
    const action = phase === "persist" ? "confirm the settings update" : "reload the current settings";
    console.error(`Twinprice could not ${action}.`, error);
  },
  describeError: errorMessage,
  translate: (key, _fallback, params) => t(key, params)
});
const currencyComboboxes = [
  createCurrencyCombobox(fromCurrencySelect, fromCurrencySearch, fromCurrencyList),
  createCurrencyCombobox(toCurrencySelect, toCurrencySearch, toCurrencyList)
];

// Show the browser's language straight away; the saved choice replaces it once
// the settings arrive, so nobody sees a flash of English first.
applyLanguage("auto");
rateMetaTextNode.textContent = t("popup.rateLoading");
rememberSiteHelpNode.textContent = t("popup.rememberHelp");
siteStateNode.textContent = t("popup.currentPage");
quickOutputLabelNode.textContent = t("popup.result");

initialize().then(() => {
  popupReady = true;
  setPopupInteractivity(true);
}).catch(handleInitializationFailure);

async function initialize() {
  [activeTab] = await ExtensionAPI.tabs.query({ active: true, currentWindow: true });
  const origin = getActiveOrigin();
  const activePageUrl = activeTab?.url || origin;
  pageConversionError = activeTab?.id
    ? CurrencyPageAccess.unsupportedPageMessage(activePageUrl)
    : t("popup.noActivePage");
  const [currenciesResult, settingsResult, statusResult, localPreferences] = await Promise.all([
    ExtensionAPI.runtime.sendMessage({ type: M.GET_CURRENCIES }),
    ExtensionAPI.runtime.sendMessage({ type: M.GET_SETTINGS, origin: activePageUrl }),
    activePageUrl
      ? ExtensionAPI.runtime.sendMessage({ type: M.GET_SITE_STATUS, origin: activePageUrl })
      : Promise.resolve({ ok: false, remembered: false }),
    ExtensionAPI.storage.local.get(["recentCurrencies", "recentPairs"])
  ]);

  if (!currenciesResult?.ok || !settingsResult?.ok) throw new Error(t("popup.settingsLoadFailed"));
  currencies = currenciesResult.currencies;
  currencyDetails = new Map((currenciesResult.details || []).map((currency) => [currency.code, currency]));
  catalogWarning = currenciesResult.warning || null;
  recentCurrencies = localPreferences.recentCurrencies || [];
  recentPairs = normalizeRecentPairs(localPreferences.recentPairs);
  const settings = settingsController.initialize(settingsResult.settings);
  if (!settings) throw new Error(t("popup.invalidSettings"));
  applyLanguage(settings.language);
  populateCurrencyLists();
  enabledInput.checked = settings.enabled;
  fromCurrencySelect.value = settings.fromCurrency;
  toCurrencySelect.value = settings.toCurrency;
  syncCurrencyComboboxes();
  applyTheme(settings.theme);
  displayModeSelect.value = settings.displayMode;
  applyAppearanceSettings(settings, { announce: false });
  showPagePromptInput.checked = settings.showPagePrompt;
  siteStatus = statusResult;
  rememberSiteInput.checked = Boolean(statusResult?.remembered);
  rememberSiteInput.disabled = true;
  rememberSiteInput.title = statusResult?.ok
    ? ""
    : statusResult?.error || t("popup.cannotRemember");
  updateRememberSiteHelp();
  // Leftover site data is only ever discovered by a failed remember/forget in
  // this popup session; a freshly opened popup never has cleanup pending.
  clearSiteButton.hidden = true;
  let badgeText = "";
  if (activeTab?.id) {
    try {
      badgeText = await ExtensionAPI.action.getBadgeText({ tabId: activeTab.id });
    } catch (_error) {
      // Restricted pages may not expose tab-scoped action state.
    }
  }
  clearPageButton.hidden = !badgeText;
  clearPageButton.disabled = true;
  updateSecondaryActions();
  updateSiteState();
  siteStateNode.title = `${
    t(currenciesResult.stale ? "popup.catalogCached" : "popup.catalogAvailable", {
      count: currencies.length
    })
  }${catalogWarning ? `. ${catalogWarning}` : ""}`;
  updateSwapState();
  updateCurrencyDiscs();
  renderRecentPairs();
  updatePrimaryActionLabel();
  if (pageConversionError) {
    setStatus(t("popup.pageUnavailableStatus", { message: pageConversionError }), "warning");
  }

  enabledInput.addEventListener("change", () => {
    updatePrimaryActionLabel();
    saveSettings();
  });
  fromCurrencySelect.addEventListener("change", () => {
    updateCurrencyDiscs();
    saveSettings();
  });
  toCurrencySelect.addEventListener("change", () => {
    updateCurrencyDiscs();
    saveSettings();
  });
  themeSelect.addEventListener("change", () => {
    applyTheme(themeSelect.value);
    saveSettings({ syncPage: false });
  });
  languageSelect.addEventListener("change", () => {
    applyLanguage(languageSelect.value);
    saveSettings({ syncPage: false });
  });
  displayModeSelect.addEventListener("change", () => saveSettings());
  bindAppearanceControls();
  showPagePromptInput.addEventListener("change", () => saveSettings());
  swapButton.addEventListener("click", swapCurrencies);
  rememberSiteInput.addEventListener("change", handleRememberSiteChange);
  convertSiteButton.addEventListener("click", convertWholeSite);
  clearPageButton.addEventListener("click", clearCurrentPage);
  clearSiteButton.addEventListener("click", clearWholeSite);
  quickAmountInput.addEventListener("input", scheduleQuickConversion);
  chooseQuickSourceButton.addEventListener("click", () => fromCurrencySearch.focus());
  openPageOptionsButton.addEventListener("click", () => {
    pageOptionsNode.open = true;
    pageOptionsNode.scrollIntoView({ block: "nearest" });
    pageOptionsNode.querySelector("summary")?.focus();
  });
  await calculateQuickConversion();

  const shortcutKeyNode = document.getElementById("shortcutKey");
  if (shortcutKeyNode && navigator.userAgent.includes("Mac")) {
    shortcutKeyNode.textContent = "⌘ Cmd";
  }
  renderShortcutHint();

  showReviewPromptIfDue().catch(() => {});
}

// A quiet footer line, shown only once the extension has helped on a few pages.
// Either choice is final: after "Rate it" or ×, the line never returns.
async function showReviewPromptIfDue() {
  const result = await ExtensionAPI.runtime.sendMessage({ type: M.GET_REVIEW_PROMPT });
  if (!result?.show || !result.url) return;
  reviewLinkNode.href = result.url;
  reviewPromptNode.hidden = false;
  reviewLinkNode.addEventListener("click", () => {
    reviewPromptNode.hidden = true;
    ExtensionAPI.runtime.sendMessage({ type: M.MARK_REVIEW_OPENED }).catch(() => {});
  });
  dismissReviewButton.addEventListener("click", () => {
    reviewPromptNode.hidden = true;
    ExtensionAPI.runtime.sendMessage({ type: M.DISMISS_REVIEW_PROMPT }).catch(() => {});
  });
}

function createCurrencyNames() {
  try {
    return new Intl.DisplayNames([I18n.language()], { type: "currency" });
  } catch (_error) {
    return null;
  }
}

// Switches the whole popup to `preference` ("auto" or a language code) and redraws
// every piece of text that was built from script rather than from the markup.
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
  renderShortcutHint();
  if (!popupReady) return;
  populateCurrencyLists();
  renderRecentPairs();
  updateSiteState();
  updateRememberSiteHelp();
  updateSwapState();
  updatePrimaryActionLabel();
  updateAppearancePreview({ announce: false });
  renderedHistoryPair = null;
  scheduleQuickConversion({ immediate: true });
}

// The hint wraps the shortcut keys in markup, and word order differs between
// languages, so the translation holds a {shortcut} slot for the existing node.
function renderShortcutHint() {
  hintNode.replaceChildren(...I18n.nodes("popup.hint", { shortcut: shortcutNode }));
}

function populateCurrencyLists() {
  const selectedSource = fromCurrencySelect.value;
  const selectedTarget = toCurrencySelect.value;
  const prioritized = [...new Set([...recentCurrencies, ...currencies])]
    .filter((currency) => currencies.includes(currency));
  populateCurrencyList(fromCurrencySelect, ["AUTO", ...prioritized]);
  const availableTargets = availableQuoteCurrencies
    ? prioritized.filter((currency) => availableQuoteCurrencies.has(currency))
    : prioritized;
  populateCurrencyList(toCurrencySelect, availableTargets);
  if ([...fromCurrencySelect.options].some((option) => option.value === selectedSource)) {
    fromCurrencySelect.value = selectedSource;
  }
  if ([...toCurrencySelect.options].some((option) => option.value === selectedTarget)) {
    toCurrencySelect.value = selectedTarget;
  }
  syncCurrencyComboboxes();
}

function populateCurrencyList(list, options) {
  list.innerHTML = "";
  for (const currency of options) {
    const option = document.createElement("option");
    option.value = currency;
    option.textContent = currency === "AUTO"
      ? "AUTO"
      : `${currency} — ${getCurrencyName(currency)}`;
    list.appendChild(option);
  }
}

function getCurrencyName(currency) {
  // The rate provider names currencies in English only, so another language
  // asks the browser for a native name first and keeps the provider's as backup.
  const localized = I18n.language() === "en" ? null : displayName(currency);
  if (localized) return localized;
  if (currencyDetails.get(currency)?.name) return currencyDetails.get(currency).name;
  return displayName(currency) || currency;
}

function displayName(currency) {
  try {
    const name = currencyNames?.of(currency);
    return name && name !== currency ? name : null;
  } catch (_error) {
    return null;
  }
}

function getCurrencySymbol(currency) {
  const symbols = CurrencyCatalog.CURRENCY_META[currency]?.symbols;
  if (!symbols?.length) return currency;
  return symbols.reduce((shortest, symbol) => (symbol.length < shortest.length ? symbol : shortest));
}

// Flag emoji are deliberately avoided: Windows ships no flag glyphs, so they would
// render as bare country letters. The currency's own symbol works on every platform.
function applyCurrencyDisc(node, currency) {
  const resolved = currency === "AUTO" ? lastDetectedCurrency : currency;
  const label = resolved ? getCurrencySymbol(resolved) : "AUTO";
  node.textContent = label;
  node.dataset.auto = String(currency === "AUTO" && !resolved);
  if (label.length >= 4) node.dataset.length = "long";
  else if (label.length >= 2) node.dataset.length = "medium";
  else delete node.dataset.length;
}

function updateCurrencyDiscs() {
  applyCurrencyDisc(fromCurrencyDiscNode, fromCurrencySelect.value);
  applyCurrencyDisc(toCurrencyDiscNode, toCurrencySelect.value);
}

function setRateHero({ from, to, rate, meta, kind = "fresh" }) {
  rateFromNode.textContent = from;
  rateToNode.textContent = to;
  rateValueNode.textContent = formatRateValue(rate);
  rateMetaTextNode.textContent = meta;
  rateMetaNode.dataset.kind = kind;
  replayAnimation(rateLineNode, "is-updated");
}

function setRateHeroMessage(meta, kind = "offline") {
  rateValueNode.textContent = "—";
  rateMetaTextNode.textContent = meta;
  rateMetaNode.dataset.kind = kind;
  hideSparkline();
}

// The sparkline is decorative. It is requested after the rate resolves and any
// failure just leaves it hidden, so history never blocks or breaks the hero.
async function refreshRateHistory(baseCurrency, quoteCurrency) {
  const pair = `${baseCurrency}:${quoteCurrency}`;
  if (pair === renderedHistoryPair) return;
  const requestId = ++rateHistoryRequestId;
  hideSparkline();

  let result = null;
  try {
    result = await ExtensionAPI.runtime.sendMessage({
      type: M.GET_RATE_HISTORY,
      baseCurrency,
      quoteCurrency
    });
  } catch (_error) {
    return;
  }
  if (requestId !== rateHistoryRequestId) return;
  if (!result?.ok || !Array.isArray(result.points) || result.points.length < 2) return;

  renderSparkline(result, baseCurrency, quoteCurrency);
  renderedHistoryPair = pair;
}

function hideSparkline() {
  // `hidden` is reflected by HTMLElement, not SVGElement: assigning `.hidden` on an
  // <svg> only creates an expando and leaves the attribute in place. Set it directly.
  rateSparkNode.setAttribute("hidden", "");
  renderedHistoryPair = null;
}

function renderSparkline(history, baseCurrency, quoteCurrency) {
  const width = 76;
  const height = 30;
  const padding = 3;
  const points = history.points;
  const span = history.high - history.low;
  const stepX = (width - (padding * 2)) / (points.length - 1);

  const coordinates = points.map((point, index) => {
    const x = padding + (index * stepX);
    // A flat series would divide by zero; centre it instead of collapsing to an edge.
    const ratio = span > 0 ? (point.rate - history.low) / span : 0.5;
    const y = padding + ((1 - ratio) * (height - (padding * 2)));
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });

  const line = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
  rateSparkLineNode.setAttribute("d", line);
  rateSparkFillNode.setAttribute(
    "d",
    `${line} L${coordinates[coordinates.length - 1][0]} ${height} L${coordinates[0][0]} ${height} Z`
  );
  const [lastX, lastY] = coordinates[coordinates.length - 1];
  rateSparkPointNode.setAttribute("cx", String(lastX));
  rateSparkPointNode.setAttribute("cy", String(lastY));

  const percent = history.changeRatio * 100;
  const direction = percent > 0.05 ? "up" : percent < -0.05 ? "down" : "flat";
  rateSparkTitleNode.textContent = t(`popup.spark.${direction}`, {
    base: baseCurrency,
    quote: quoteCurrency,
    percent: Math.abs(percent).toFixed(1),
    span: t("popup.spark.span", { count: points.length })
  });
  rateSparkNode.removeAttribute("hidden");
}

function formatRateValue(rate) {
  if (!Number.isFinite(rate)) return "—";
  if (rate >= 1000) return rate.toFixed(1);
  if (rate >= 0.001) return rate.toFixed(4);
  return rate.toPrecision(3);
}

function renderRecentPairs() {
  const current = `${fromCurrencySelect.value}:${toCurrencySelect.value}`;
  const pairs = recentPairs.filter((pair) => `${pair.from}:${pair.to}` !== current).slice(0, 3);
  recentPairsNode.replaceChildren();
  if (!pairs.length) {
    recentPairsNode.hidden = true;
    return;
  }

  const label = document.createElement("span");
  label.className = "recent-pairs-label";
  label.textContent = t("popup.recent");
  recentPairsNode.appendChild(label);

  for (const pair of pairs) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "pair-chip";
    chip.textContent = `${pair.from}→${pair.to}`;
    chip.title = t("popup.switchPair", { from: pair.from, to: pair.to });
    chip.disabled = !popupReady || popupLocked;
    chip.addEventListener("click", () => applyRecentPair(pair));
    recentPairsNode.appendChild(chip);
  }
  recentPairsNode.hidden = false;
}

function applyRecentPair(pair) {
  const hasSource = [...fromCurrencySelect.options].some((option) => option.value === pair.from);
  const hasTarget = [...toCurrencySelect.options].some((option) => option.value === pair.to);
  if (!hasSource || !hasTarget) {
    setStatus(t("popup.pairUnavailable"), "warning");
    return;
  }
  fromCurrencySelect.value = pair.from;
  toCurrencySelect.value = pair.to;
  syncCurrencyComboboxes();
  updateCurrencyDiscs();
  saveSettings();
}

function createCurrencyCombobox(select, input, listbox) {
  const state = { select, input, listbox, matches: [], activeIndex: -1 };

  input.addEventListener("focus", () => {
    input.select();
    openCurrencyCombobox(state, "");
  });
  input.addEventListener("click", () => {
    if (input.getAttribute("aria-expanded") !== "true") openCurrencyCombobox(state, "");
  });
  input.addEventListener("input", () => openCurrencyCombobox(state, input.value));
  input.addEventListener("keydown", (event) => handleCurrencyComboboxKeydown(event, state));
  input.addEventListener("blur", () => window.setTimeout(() => closeCurrencyCombobox(state, true), 100));
  listbox.addEventListener("mousedown", (event) => event.preventDefault());
  listbox.addEventListener("click", (event) => {
    const option = event.target.closest("[role='option']");
    if (option) chooseCurrency(state, option.dataset.value);
  });
  return state;
}

function openCurrencyCombobox(state, query = "") {
  for (const combobox of currencyComboboxes) {
    if (combobox !== state) closeCurrencyCombobox(combobox, true);
  }
  const normalizedQuery = query.trim().toLocaleLowerCase();
  state.matches = [...state.select.options].filter((option) =>
    !normalizedQuery || option.textContent.toLocaleLowerCase().includes(normalizedQuery)
  );
  state.activeIndex = Math.max(0, state.matches.findIndex((option) => option.value === state.select.value));
  renderCurrencyOptions(state);
  state.listbox.hidden = false;
  state.input.setAttribute("aria-expanded", "true");
}

function renderCurrencyOptions(state) {
  state.listbox.replaceChildren();
  if (!state.matches.length) {
    const empty = document.createElement("span");
    empty.className = "currency-list-empty";
    empty.textContent = t("popup.noCurrencies");
    state.listbox.appendChild(empty);
    state.input.removeAttribute("aria-activedescendant");
    return;
  }

  state.matches.forEach((sourceOption, index) => {
    const option = document.createElement("span");
    option.id = `${state.listbox.id}-option-${sourceOption.value}`;
    option.className = "currency-list-option";
    option.setAttribute("role", "option");
    option.dataset.value = sourceOption.value;
    option.setAttribute("aria-selected", String(sourceOption.value === state.select.value));
    if (index === state.activeIndex) option.dataset.active = "true";

    const code = document.createElement("strong");
    code.textContent = sourceOption.value;
    option.appendChild(code);
    const name = document.createElement("span");
    name.textContent = sourceOption.value === "AUTO"
      ? t("popup.autoDetect")
      : getCurrencyName(sourceOption.value);
    option.appendChild(name);
    state.listbox.appendChild(option);
  });
  updateActiveCurrencyOption(state);
}

function handleCurrencyComboboxKeydown(event, state) {
  if (event.key === "Escape") {
    closeCurrencyCombobox(state, true);
    state.input.select();
    return;
  }
  if (event.key === "Tab") {
    closeCurrencyCombobox(state, true);
    return;
  }
  if (event.key === "Enter") {
    if (state.input.getAttribute("aria-expanded") === "true" && state.matches[state.activeIndex]) {
      event.preventDefault();
      chooseCurrency(state, state.matches[state.activeIndex].value);
    }
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  if (state.input.getAttribute("aria-expanded") !== "true") openCurrencyCombobox(state, "");
  const direction = event.key === "ArrowDown" ? 1 : -1;
  state.activeIndex = Math.min(state.matches.length - 1, Math.max(0, state.activeIndex + direction));
  updateActiveCurrencyOption(state);
}

function updateActiveCurrencyOption(state) {
  const options = [...state.listbox.querySelectorAll("[role='option']")];
  options.forEach((option, index) => {
    if (index === state.activeIndex) option.dataset.active = "true";
    else delete option.dataset.active;
  });
  const active = options[state.activeIndex];
  if (active) {
    state.input.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  } else {
    state.input.removeAttribute("aria-activedescendant");
  }
}

function chooseCurrency(state, value) {
  state.select.value = value;
  syncCurrencyCombobox(state);
  closeCurrencyCombobox(state, false);
  state.input.focus();
  state.input.select();
  state.select.dispatchEvent(new Event("change", { bubbles: true }));
}

function closeCurrencyCombobox(state, restoreLabel) {
  state.listbox.hidden = true;
  state.input.setAttribute("aria-expanded", "false");
  state.input.removeAttribute("aria-activedescendant");
  if (restoreLabel) syncCurrencyCombobox(state);
}

function syncCurrencyCombobox(state) {
  const selected = state.select.selectedOptions[0];
  // Only the code is shown: the symbol disc beside it carries recognition and the
  // full name would truncate at this width. Names stay visible in the listbox and
  // remain searchable, because filtering still reads the option's full text.
  state.input.value = selected?.value || state.select.value;
  state.input.title = selected?.textContent || "";
}

function syncCurrencyComboboxes() {
  currencyComboboxes.forEach(syncCurrencyCombobox);
}

function bindAppearanceControls() {
  bindColorControl(convertedTextColorInput, convertedTextColorHexInput);
  bindColorControl(convertedBackgroundColorInput, convertedBackgroundColorHexInput);
  for (const input of convertedShapeInputs) {
    input.addEventListener("change", () => {
      updateAppearancePreview();
      saveSettings();
    });
  }
  resetAppearanceButton.addEventListener("click", () => {
    applyAppearanceSettings(CurrencySettings.DEFAULTS);
    saveSettings();
  });
}

function bindColorControl(colorInput, hexInput) {
  colorInput.addEventListener("input", () => {
    markSettingsDraft();
    hexInput.value = colorInput.value.toUpperCase();
    clearHexColorError(hexInput);
    updateAppearancePreview();
  });
  colorInput.addEventListener("change", () => saveSettings());
  hexInput.addEventListener("input", () => {
    markSettingsDraft();
    const color = CurrencySettings.normalizeHexColor(hexInput.value.trim());
    if (!color) {
      hexInput.setAttribute("aria-invalid", "true");
      return;
    }
    clearHexColorError(hexInput);
    colorInput.value = color;
    updateAppearancePreview();
  });
  hexInput.addEventListener("change", () => {
    const color = CurrencySettings.normalizeHexColor(hexInput.value.trim());
    if (!color) {
      hexInput.setAttribute("aria-invalid", "true");
      hexInput.setCustomValidity(t("popup.hexInvalid"));
      setStatus(t("popup.hexInvalidStatus"), "error");
      return;
    }
    clearHexColorError(hexInput);
    colorInput.value = color;
    hexInput.value = color.toUpperCase();
    updateAppearancePreview();
    saveSettings();
  });
}

function clearHexColorError(input) {
  input.removeAttribute("aria-invalid");
  input.setCustomValidity("");
}

function markSettingsDraft() {
  settingsController.markDraft();
}

function selectedConvertedShape() {
  return convertedShapeInputs.find((input) => input.checked)?.value ||
    CurrencySettings.DEFAULTS.convertedShape;
}

function applyAppearanceSettings(settings, { announce = true } = {}) {
  const appearance = CurrencySettings.normalizeAppearance(settings);
  const textColor = appearance.convertedTextColor;
  const backgroundColor = appearance.convertedBackgroundColor;
  const shape = appearance.convertedShape;

  convertedTextColorInput.value = textColor;
  convertedTextColorHexInput.value = textColor.toUpperCase();
  convertedBackgroundColorInput.value = backgroundColor;
  convertedBackgroundColorHexInput.value = backgroundColor.toUpperCase();
  clearHexColorError(convertedTextColorHexInput);
  clearHexColorError(convertedBackgroundColorHexInput);
  for (const input of convertedShapeInputs) input.checked = input.value === shape;
  updateAppearancePreview({ announce });
}

function updateAppearancePreview({ announce = true } = {}) {
  const textColor = CurrencySettings.normalizeHexColor(convertedTextColorInput.value) ||
    CurrencySettings.DEFAULTS.convertedTextColor;
  const backgroundColor = CurrencySettings.normalizeHexColor(convertedBackgroundColorInput.value) ||
    CurrencySettings.DEFAULTS.convertedBackgroundColor;
  const shape = selectedConvertedShape();
  const radius = CurrencySettings.SHAPE_RADII[shape] ||
    CurrencySettings.SHAPE_RADII[CurrencySettings.DEFAULTS.convertedShape];

  appearancePreviewNode.style.color = textColor;
  appearancePreviewNode.style.backgroundColor = backgroundColor;
  appearancePreviewNode.style.borderRadius = radius;
  appearancePreviewNode.setAttribute("aria-label", t("popup.previewAfterAria", {
    text: textColor.toUpperCase(),
    background: backgroundColor.toUpperCase()
  }));

  const contrast = colorContrastRatio(textColor, backgroundColor);
  const result = describeContrast(contrast);
  appearanceContrastNode.dataset.kind = result.kind;
  appearanceContrastNode.textContent = result.text;
  updateAppearanceResetState();
  if (announce) {
    scheduleAppearanceAnnouncement(t("popup.previewAnnouncement", {
      text: textColor.toUpperCase(),
      background: backgroundColor.toUpperCase(),
      contrast: result.text
    }));
  }
}

function describeContrast(contrast) {
  const ratio = contrast.toFixed(2);
  if (contrast >= 7) {
    return { kind: "pass", text: t("popup.contrastAAA", { ratio }) };
  }
  if (contrast >= 4.5) {
    return { kind: "pass", text: t("popup.contrastAA", { ratio }) };
  }
  if (contrast >= 3) {
    return { kind: "warning", text: t("popup.contrastLow", { ratio }) };
  }
  return { kind: "fail", text: t("popup.contrastFail", { ratio }) };
}

function colorContrastRatio(first, second) {
  const firstLuminance = colorLuminance(first);
  const secondLuminance = colorLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorLuminance(color) {
  const channels = color.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function scheduleAppearanceAnnouncement(message) {
  window.clearTimeout(appearanceAnnouncementTimer);
  appearanceAnnouncementTimer = window.setTimeout(() => {
    appearanceAnnouncementNode.textContent = message;
  }, 300);
}

function updateAppearanceResetState() {
  resetAppearanceButton.disabled = !popupReady || popupLocked;
}

function saveSettings({ syncPage = true } = {}) {
  const payload = readSettingsFromControls();
  return settingsController.save(payload, {
    validationError: validateSettingsPayload(payload),
    syncPage
  });
}

function handleInitializationFailure(error) {
  popupLocked = true;
  siteStateNode.textContent = t("popup.unavailable");
  setRateHeroMessage(t("popup.rateServiceDown"), "offline");
  setPopupInteractivity(false);
  setStatus(t("popup.startFailed", { error: errorMessage(error) }), "error");
}

function lockPopupInteractions(message) {
  popupLocked = true;
  setPopupInteractivity(false);
  setStatus(message, "error");
}

function setPopupInteractivity(enabled) {
  const interactive = Boolean(enabled && popupReady && !popupLocked);
  popupAppNode.setAttribute("aria-busy", String(!popupReady && !popupLocked));
  quickConverterNode.inert = !interactive;
  pageOptionsNode.inert = !interactive;

  for (const control of [
    fromCurrencySelect,
    toCurrencySelect,
    fromCurrencySearch,
    toCurrencySearch,
    swapButton,
    themeSelect,
    languageSelect,
    displayModeSelect,
    convertedTextColorInput,
    convertedTextColorHexInput,
    convertedBackgroundColorInput,
    convertedBackgroundColorHexInput,
    ...convertedShapeInputs,
    resetAppearanceButton,
    showPagePromptInput,
    enabledInput,
    quickAmountInput,
    chooseQuickSourceButton,
    openPageOptionsButton
  ]) {
    control.disabled = !interactive;
  }
  for (const chip of recentPairsNode.querySelectorAll(".pair-chip")) {
    chip.disabled = !interactive;
  }

  rememberSiteInput.disabled = !interactive || !siteStatus?.ok;
  if (!interactive) {
    clearPageButton.disabled = true;
    clearSiteButton.disabled = true;
  }
  updateSecondaryActions();
  updatePrimaryActionLabel();
  updateAppearanceResetState();
}

function readSettingsFromControls() {
  return {
    enabled: enabledInput.checked,
    fromCurrency: fromCurrencySelect.value,
    toCurrency: toCurrencySelect.value,
    theme: themeSelect.value,
    language: languageSelect.value,
    displayMode: displayModeSelect.value,
    convertedTextColor: convertedTextColorInput.value,
    convertedBackgroundColor: convertedBackgroundColorInput.value,
    convertedShape: selectedConvertedShape(),
    showPagePrompt: showPagePromptInput.checked
  };
}

function validateSettingsPayload(payload) {
  if (!["AUTO", ...currencies].includes(payload.fromCurrency) ||
      !currencies.includes(payload.toCurrency)) {
    return t("popup.validateCurrency");
  }
  if (payload.fromCurrency === payload.toCurrency) return t("popup.validateDifferent");
  if (!CurrencySettings.THEMES.includes(payload.theme)) {
    return t("popup.validateTheme");
  }
  if (!CurrencySettings.LANGUAGES.includes(payload.language)) {
    return t("popup.validateLanguage");
  }
  if (!CurrencySettings.normalizeHexColor(payload.convertedTextColor) ||
      !CurrencySettings.normalizeHexColor(payload.convertedBackgroundColor)) {
    return t("popup.validateColors");
  }
  if (!CurrencySettings.CONVERTED_SHAPES.includes(payload.convertedShape)) {
    return t("popup.validateShape");
  }
  return null;
}

function dispatchSettingsUpdate(payload) {
  return ExtensionAPI.runtime.sendMessage({
    type: M.UPDATE_SETTINGS,
    origin: activeTab?.url,
    payload
  });
}

async function fetchActualSettings() {
  const result = await ExtensionAPI.runtime.sendMessage({
    type: M.GET_SETTINGS,
    origin: activeTab?.url
  });
  return result?.ok ? result.settings : null;
}

async function finalizeSavedSettings(settings, { syncPage, isCurrent }) {
  try {
    await storeRecentCurrencies(settings);
  } catch (_error) {
    // Recent currencies are a convenience and do not affect whether the settings were saved.
  }
  if (!isCurrent()) return;

  scheduleQuickConversion({ immediate: true });
  setStatus(
    settings.enabled
      ? t("popup.status.ready")
      : siteStatus?.remembered
        ? t("popup.status.offPaused")
        : t("popup.status.off"),
    "success"
  );
  if (syncPage) {
    const pageResult = await sendToActivePage(
      settings.enabled ? M.SHOW_CONVERT_PROMPT : M.CLEAR_SITE_CONVERSION,
      settings.enabled ? {} : { suppressPrompt: true }
    );
    if (!isCurrent()) return;
    if (!pageResult?.ok) setStatus(pageResult?.error || t("popup.cannotAccess"), "error");
    else if (!settings.enabled) {
      clearPageButton.disabled = true;
      clearPageButton.hidden = true;
      updateSecondaryActions();
    }
  }
  updateSiteState();
}

function applySettingsToControls(settings) {
  if (!settings) return;
  enabledInput.checked = settings.enabled;
  fromCurrencySelect.value = settings.fromCurrency;
  toCurrencySelect.value = settings.toCurrency;
  applyTheme(settings.theme);
  if (languageSelect.value !== settings.language) applyLanguage(settings.language);
  displayModeSelect.value = settings.displayMode;
  applyAppearanceSettings(settings, { announce: false });
  showPagePromptInput.checked = settings.showPagePrompt;
  syncCurrencyComboboxes();
  updateCurrencyDiscs();
  renderRecentPairs();
  updatePrimaryActionLabel();
  updateSwapState();
  updateSiteState();
  scheduleQuickConversion({ immediate: true });
}

function applyTheme(theme) {
  const normalizedTheme = CurrencySettings.THEMES.includes(theme)
    ? theme
    : CurrencySettings.DEFAULTS.theme;
  themeSelect.value = normalizedTheme;
  document.documentElement.dataset.theme = normalizedTheme;
}

function swapCurrencies() {
  const source = fromCurrencySelect.value === "AUTO" ? lastDetectedCurrency : fromCurrencySelect.value;
  if (!source) {
    setStatus(t("popup.needsConvertOnce"), "error");
    return;
  }
  const target = toCurrencySelect.value;
  replayAnimation(swapButton, "is-swapping");
  fromCurrencySelect.value = target;
  toCurrencySelect.value = source;
  syncCurrencyComboboxes();
  updateCurrencyDiscs();
  saveSettings();
}

function updateSwapState() {
  swapButton.title = fromCurrencySelect.value === "AUTO" && !lastDetectedCurrency
    ? t("popup.swapNeedsConvert")
    : t("popup.swap");
}

async function handleRememberSiteChange() {
  const origin = getActiveOrigin();
  if (!origin || !siteStatus?.ok) {
    rememberSiteInput.checked = false;
    setStatus(t("popup.cannotRemember"), "error");
    return;
  }

  rememberSiteInput.disabled = true;
  let setupFailureState = null;
  try {
    if (rememberSiteInput.checked) {
      const result = await ExtensionAPI.runtime.sendMessage({ type: M.REMEMBER_SITE, origin });
      if (!result?.ok) {
        setupFailureState = result;
        siteStatus.remembered = Boolean(result?.remembered);
        siteStatus.cleanupRequired = Boolean(result?.dataRemaining);
        throw new Error(result?.error || t("popup.rememberFailed"));
      }
      siteStatus.remembered = true;
      siteStatus.cleanupRequired = false;
      clearSiteButton.hidden = true;
      updateSecondaryActions();
      setStatus(t("popup.autoOn", { host: safeUrl(origin)?.hostname || t("popup.thisSite") }), "success");
    } else {
      const pageClearResult = await sendToActivePage(M.CLEAR_SITE_CONVERSION, {
        forgetSite: false,
        suppressPrompt: true
      });
      const result = await ExtensionAPI.runtime.sendMessage({ type: M.FORGET_SITE, origin });
      if (!result?.ok) {
        setupFailureState = result;
        siteStatus.remembered = Boolean(result?.remembered);
        siteStatus.cleanupRequired = Boolean(result?.dataRemaining);
        clearSiteButton.hidden = false;
        throw new Error(result?.error || t("popup.forgetFailed"));
      }
      siteStatus.remembered = false;
      siteStatus.cleanupRequired = false;
      clearSiteButton.hidden = true;
      if (pageClearResult?.ok) {
        clearPageButton.disabled = true;
        clearPageButton.hidden = true;
      }
      updateSecondaryActions();
      setStatus(
        pageClearResult?.ok
          ? t("popup.autoOff", { host: safeUrl(origin)?.hostname || t("popup.thisSite") })
          : t("popup.autoOffReload"),
        pageClearResult?.ok ? "success" : "warning"
      );
    }
  } catch (error) {
    clearSiteButton.hidden = !(
      siteStatus?.cleanupRequired || setupFailureState?.dataRemaining
    );
    rememberSiteInput.checked = Boolean(siteStatus?.remembered);
    setStatus(error.message, "error");
  } finally {
    rememberSiteInput.disabled = !popupReady || popupLocked || !siteStatus?.ok;
    updateSiteState();
    updateSecondaryActions();
  }
}

async function convertWholeSite() {
  if (pageConversionError) {
    setStatus(t("popup.pageUnavailableStatus", { message: pageConversionError }), "warning");
    return;
  }
  const turningOn = !enabledInput.checked;
  if (turningOn) {
    enabledInput.checked = true;
    setBusy(true, { turningOn: true });
    const saved = await saveSettings({ syncPage: false });
    if (!saved) {
      setBusy(false);
      updateSiteState();
      return;
    }
  } else {
    setBusy(true);
  }
  setStatus(t("popup.scanning"));
  const result = await sendToActivePage(M.RUN_SITE_CONVERSION);
  setBusy(false);
  if (result?.cancelled) {
    clearPageButton.hidden = true;
    updateSecondaryActions();
    setStatus(
      enabledInput.checked
        ? t("popup.cancelled")
        : siteStatus?.remembered
          ? t("popup.status.offPaused")
          : t("popup.status.off"),
      enabledInput.checked ? "warning" : "success"
    );
    return;
  }
  if (!result?.ok && !Number.isFinite(result?.count)) {
    setStatus(
      turningOn
        ? t("popup.turnedOnFailed", { detail: result?.error || t("popup.tryAgain") })
        : result?.error || t("popup.convertFailed"),
      "error"
    );
    return;
  }
  lastDetectedCurrency = result.detectedCurrency || null;
  updateSwapState();
  updateCurrencyDiscs();
  scheduleQuickConversion({ immediate: true });
  const hasConversions = result.count > 0;
  clearPageButton.disabled = !hasConversions;
  clearPageButton.hidden = !hasConversions;
  updateSecondaryActions();
  setStatus(
    hasConversions
      ? `${t("popup.converted", { count: result.count })}${
        result.scanLimited ? ` ${t("popup.scanLimit")}` : ""
      }`
      : `${t("popup.noPrices")}${result?.error ? ` ${result.error}` : ""}`,
    hasConversions ? "success" : "warning"
  );
  const cachedPart = result.staleRates
    ? t(result.cacheAgeLabel ? "popup.cachedAge" : "popup.cached", { age: result.cacheAgeLabel })
    : "";
  const fullRateInfo = result.rateDate
    ? [
      t("popup.rateDateFull", { date: result.rateDate }),
      result.rateProvider || null,
      cachedPart || null,
      result.rateWarning ? t("popup.warning", { warning: result.rateWarning }) : null
    ].filter(Boolean).join(" · ")
    : "";
  rateInfoNode.textContent = result.rateDate
    ? [t("popup.rateShort", { date: result.rateDate }), cachedPart || null]
      .filter(Boolean)
      .join(" · ")
    : "";
  rateInfoNode.title = fullRateInfo;
  if (result.rateWarning) rateInfoNode.dataset.kind = "warning";
  else delete rateInfoNode.dataset.kind;
}

async function clearWholeSite() {
  const result = await sendToActivePage(M.CLEAR_SITE_CONVERSION, { forgetSite: true });
  if (!result?.ok) {
    siteStatus.remembered = Boolean(result?.remembered);
    siteStatus.cleanupRequired = true;
    rememberSiteInput.checked = Boolean(result?.remembered);
    clearSiteButton.hidden = false;
    updateSecondaryActions();
    updateSiteState();
    setStatus(result?.error || t("popup.clearFailed"), "error");
    return;
  }
  siteStatus.remembered = false;
  siteStatus.cleanupRequired = false;
  rememberSiteInput.checked = false;
  moveFocusBeforeHiding(clearSiteButton);
  clearSiteButton.hidden = true;
  updateSecondaryActions();
  updateSiteState();
  setStatus(t("popup.siteCleared"), "success");
}

async function clearCurrentPage() {
  const result = await sendToActivePage(M.CLEAR_SITE_CONVERSION, {
    forgetSite: false,
    suppressPrompt: true
  });
  setStatus(
    result?.ok ? t("popup.undone") : result?.error || t("popup.undoFailed"),
    result?.ok ? "success" : "error"
  );
  if (result?.ok) {
    moveFocusBeforeHiding(clearPageButton);
    clearPageButton.disabled = true;
    clearPageButton.hidden = true;
    updateSecondaryActions();
  }
}

function setBusy(busy, { turningOn = false } = {}) {
  primaryActionBusy = busy;
  convertSiteButton.disabled = busy || Boolean(pageConversionError);
  if (busy) {
    convertSiteButton.textContent = turningOn
      ? t("popup.busyTurningOn")
      : t("popup.busyConverting");
  } else {
    updatePrimaryActionLabel();
  }
}

function updatePrimaryActionLabel() {
  if (primaryActionBusy) return;
  if (!popupReady || popupLocked) {
    convertSiteButton.disabled = true;
    return;
  }
  if (pageConversionError) {
    convertSiteButton.disabled = true;
    convertSiteButton.textContent = t("popup.convertUnavailable");
    return;
  }
  convertSiteButton.disabled = false;
  convertSiteButton.textContent = enabledInput.checked
    ? t("popup.convertPage")
    : t("popup.turnOnConvert");
}

function updateSecondaryActions() {
  const interactive = popupReady && !popupLocked;
  clearPageButton.disabled = !interactive || clearPageButton.hidden;
  clearSiteButton.disabled = !interactive || clearSiteButton.hidden;
  secondaryActionsNode.hidden = clearPageButton.hidden && clearSiteButton.hidden;
}

function moveFocusBeforeHiding(node, wasFocused = node?.contains(document.activeElement)) {
  if (!wasFocused) return;
  const candidates = [
    convertSiteButton,
    fromCurrencySearch,
    quickAmountInput,
    pageOptionsNode.querySelector("summary")
  ];
  const target = candidates.find((candidate) =>
    candidate &&
    !candidate.disabled &&
    !candidate.hidden &&
    !candidate.closest("[hidden]") &&
    !candidate.closest("[inert]")
  );
  target?.focus();
}

function setStatus(message, kind = "") {
  statusNode.textContent = message;
  if (kind) {
    statusNode.dataset.kind = kind;
    statusContainerNode.dataset.kind = kind;
  } else {
    delete statusNode.dataset.kind;
    delete statusContainerNode.dataset.kind;
  }
  statusContainerNode.dataset.visible = message ? "true" : "false";
  if (message && kind === "success") replayAnimation(statusContainerNode, "is-success-pulse");
}

function replayAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  node.addEventListener("animationend", () => node.classList.remove(className), { once: true });
}

function scheduleQuickConversion({ immediate = false } = {}) {
  if (quickConversionTimer) window.clearTimeout(quickConversionTimer);
  quickConversionTimer = window.setTimeout(calculateQuickConversion, immediate ? 0 : 250);
}

async function calculateQuickConversion() {
  quickConversionTimer = null;
  const requestId = ++quickConversionRequestId;
  const sourceCurrency = fromCurrencySelect.value === "AUTO"
    ? lastDetectedCurrency
    : fromCurrencySelect.value;
  const targetCurrency = toCurrencySelect.value;
  const amountText = quickAmountInput.value.trim();

  if (!sourceCurrency) {
    availableQuoteCurrencies = null;
    availableRatesSource = null;
    populateCurrencyLists();
    quickSourceRequiredNode.hidden = false;
    quickConverterFieldsNode.hidden = true;
    setRateHeroMessage(t("popup.needsConvertOnce"), "stale");
    setQuickConversionState(t("popup.chooseSourceShort"), t("popup.chooseSourceDetail"), "empty");
    return;
  }
  quickSourceRequiredNode.hidden = true;
  quickConverterFieldsNode.hidden = false;
  if (!currencies.includes(sourceCurrency) || !currencies.includes(targetCurrency)) {
    setRateHeroMessage(t("popup.chooseSupported"), "offline");
    setQuickConversionState(t("popup.chooseCurrencies"), t("popup.chooseSupported"), "error");
    return;
  }
  if (sourceCurrency === targetCurrency) {
    setRateHeroMessage(t("popup.mustDiffer"), "offline");
    setQuickConversionState(t("popup.chooseDifferent"), t("popup.mustDiffer"), "error");
    return;
  }
  // The rate is fetched even when the amount is unusable so the header hero stays
  // truthful while the amount field is empty or mid-edit.
  const amount = amountText ? CurrencyNumberParser.parseLocaleNumber(amountText, {
    allowThreeDecimals: CurrencyCatalog.currencyFractionDigits(sourceCurrency) === 3
  }) : NaN;
  const amountProblem = !amountText
    ? { result: t("popup.enterAmount"), detail: "" }
    : !Number.isFinite(amount)
      ? { result: t("popup.invalidAmount"), detail: t("popup.invalidAmountDetail") }
      : null;

  quickOutputLabelNode.textContent = getCurrencyName(targetCurrency);
  if (amountProblem) setQuickConversionState(amountProblem.result, amountProblem.detail, "error");
  else setQuickConversionState(t("popup.convertingShort"), "", "loading");
  if (availableRatesSource !== sourceCurrency) {
    availableQuoteCurrencies = null;
    availableRatesSource = sourceCurrency;
  }
  const result = await ExtensionAPI.runtime.sendMessage({ type: M.GET_RATES, baseCurrency: sourceCurrency });
  if (requestId !== quickConversionRequestId) return;
  if (result?.ok) {
    availableQuoteCurrencies = new Set(Object.keys(result.rates || {}));
    availableQuoteCurrencies.add(sourceCurrency);
    populateCurrencyLists();
  }
  const rate = result?.rates?.[targetCurrency];
  if (!result?.ok || !Number.isFinite(rate)) {
    const unavailable = result?.error ||
      t("popup.noRate", { from: sourceCurrency, to: targetCurrency });
    setRateHeroMessage(unavailable, "offline");
    setQuickConversionState(t("popup.rateUnavailable"), unavailable, "error");
    return;
  }

  setRateHero({
    from: sourceCurrency,
    to: targetCurrency,
    rate,
    meta: describeRateFreshness(result),
    kind: result.stale ? "stale" : "fresh"
  });
  refreshRateHistory(sourceCurrency, targetCurrency);
  if (amountProblem) return;

  const converted = CurrencyCatalog.formatCurrencyAmount(amount * rate, targetCurrency);
  const cached = result.stale
    ? t(result.cacheAgeLabel ? "popup.cachedAge" : "popup.cached", { age: result.cacheAgeLabel })
    : null;
  const details = [
    `1 ${sourceCurrency} = ${rate} ${targetCurrency}`,
    result.date ? t("popup.rateDateFull", { date: result.date }) : null,
    result.provider || null,
    cached,
    result.warning || null,
    catalogWarning ? t("popup.catalogWarning", { warning: catalogWarning }) : null
  ].filter(Boolean).join(" · ");
  const summary = [
    `1 ${sourceCurrency} = ${rate} ${targetCurrency}`,
    result.date || null,
    cached
  ].filter(Boolean).join(" · ");
  setQuickConversionState(converted, summary, result.warning ? "warning" : "success", details);
}

function setQuickConversionState(result, details, kind, fullDetails = details) {
  quickResultNode.textContent = result;
  quickResultNode.dataset.kind = kind;
  quickRateInfoNode.textContent = details;
  quickRateInfoNode.title = fullDetails;
  if (kind === "warning") quickRateInfoNode.dataset.kind = "warning";
  else delete quickRateInfoNode.dataset.kind;
  if (kind !== "loading") replayAnimation(quickResultNode, "is-updated");
}

function updateRememberSiteHelp() {
  const host = safeUrl(activeTab?.url)?.hostname;
  rememberSiteHelpNode.textContent = siteStatus?.ok
    ? host
      ? t("popup.rememberHelpHost", { host })
      : t("popup.rememberHelp")
    : siteStatus?.error || t("popup.cannotRemember");
}

function updateSiteState() {
  const hostname = activeTab?.url ? safeUrl(activeTab.url)?.hostname : "";
  siteStateNode.textContent = siteStatus?.remembered
    ? t(enabledInput.checked ? "popup.siteAutoOn" : "popup.siteAutoPaused", {
      host: hostname || t("popup.currentSite")
    })
    : hostname || t("popup.currentPage");
}

function getActiveOrigin() {
  const url = safeUrl(activeTab?.url);
  return url && /^https?:$/.test(url.protocol) ? url.origin : null;
}

function safeUrl(value) {
  try { return new URL(value); } catch (_error) { return null; }
}

function describeRateFreshness(result) {
  if (result.stale) {
    return [
      t(result.cacheAgeLabel ? "popup.cachedAge" : "popup.cached", { age: result.cacheAgeLabel }),
      result.date || null
    ].filter(Boolean).join(" · ");
  }
  return [
    result.date ? t("popup.rateShort", { date: result.date }) : t("popup.latestRate"),
    result.provider || null
  ]
    .filter(Boolean)
    .join(" · ");
}

function normalizeRecentPairs(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const pairs = [];
  for (const entry of value) {
    if (typeof entry?.from !== "string" || typeof entry?.to !== "string") continue;
    const key = `${entry.from}:${entry.to}`;
    if (entry.from === entry.to || seen.has(key)) continue;
    seen.add(key);
    pairs.push({ from: entry.from, to: entry.to });
  }
  return pairs.slice(0, 6);
}

async function storeRecentCurrencies(settings) {
  const candidates = [settings.fromCurrency, settings.toCurrency, ...recentCurrencies]
    .filter((currency) => currency !== "AUTO");
  recentCurrencies = [...new Set(candidates)].slice(0, 6);
  recentPairs = normalizeRecentPairs([
    { from: settings.fromCurrency, to: settings.toCurrency },
    ...recentPairs
  ]);
  await ExtensionAPI.storage.local.set({ recentCurrencies, recentPairs });
  populateCurrencyLists();
  renderRecentPairs();
}

async function sendToActivePage(type, payload = {}) {
  if (!activeTab?.id) return { ok: false, error: t("popup.noTab") };
  const unsupportedPage = CurrencyPageAccess.unsupportedPageMessage(activeTab.url);
  if (unsupportedPage) return { ok: false, error: unsupportedPage };
  try {
    await ensureContentScripts(activeTab.id);
    return await ExtensionAPI.tabs.sendMessage(activeTab.id, { type, ...payload }) || {
      ok: false,
      error: t("popup.pageNoResponse")
    };
  } catch (error) {
    console.error("Twinprice could not reach the active page.", error);
    return { ok: false, error: CurrencyPageAccess.describeFailure(activeTab, error) };
  }
}

function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : String(error || t("popup.unknownError"));
}
