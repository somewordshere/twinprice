(function initializeContentEntry() {
  if (globalThis.__ccpContentInitialized) return;
  globalThis.__ccpContentInitialized = true;

  const M = CurrencyMessages;
  const t = (key, params) => CurrencyI18n.t(key, params);
  // Until the saved language arrives, follow the browser's.
  CurrencyI18n.setLanguage("auto");
  // History routing fires no event of its own, so a slow poll is the portable
  // backstop behind popstate/hashchange and the Navigation API.
  const ROUTE_POLL_INTERVAL_MS = 1000;
  let settings = null;
  let settingsLoadPromise = null;
  let pageCommandGeneration = 0;
  let renderedConversionSettingsKey = null;
  let successRecorded = false;
  let currentRoute = readRouteKey();

  ExtensionAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === M.CONTENT_READY) {
      sendResponse({ ok: true });
      return;
    }

    const task = handleMessage(message);
    if (!task) return;
    task.then(sendResponse).catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : t("error.pageRequest")
    }));
    return true;
  });

  ExtensionAPI.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "sync") {
      const rateSettingsChanged = CurrencySettings.changesInclude(
        changes,
        CurrencySettings.RATE_AFFECTING_KEYS
      );
      const presentationSettingsChanged = CurrencySettings.changesInclude(
        changes,
        CurrencySettings.PRESENTATION_KEYS
      );
      const conversionSettingsChanged = rateSettingsChanged || presentationSettingsChanged;
      if (conversionSettingsChanged || changes.showPagePrompt || changes.language) {
        if (rateSettingsChanged) invalidatePendingPageCommands();
        await queueSettingsReload({ failClosed: rateSettingsChanged });
      }
    }
    if (areaName === "local") {
      const ratesChanged = changes.ratesCache &&
        CurrencyPageConverter.ratesCacheChangeAffectsActiveRates(changes.ratesCache);
      if (ratesChanged) await queueSettingsTask(refreshRenderedConversionsForRates);
      const sourceChanged = changes.siteSourceCurrencies &&
        changeAffectsCurrentOrigin(changes.siteSourceCurrencies);
      const preferenceChanged = changes.autoConvertSites &&
        changeAffectsCurrentOrigin(changes.autoConvertSites);
      if (!sourceChanged && !preferenceChanged) return;
      invalidatePendingPageCommands();
      const preferenceRemoved = preferenceChanged &&
        sitePreferenceWasRemovedFromCurrentOrigin(changes.autoConvertSites);
      if (preferenceRemoved) {
        clearRenderedConversions();
        CurrencyPageUi.clearTransientUi();
        CurrencyPageUi.removePageConvertPrompt();
      }
      const badgeUpdate = preferenceRemoved ? updateBadge(0) : Promise.resolve();
      await Promise.all([
        badgeUpdate,
        queueSettingsReload({ failClosed: true })
      ]);
    }
  });

  CurrencyPageUi.installSelectionListeners();
  installRouteChangeWatcher();
  settingsLoadPromise = loadSettings(pageCommandGeneration, { failClosed: true });

  // Single-page apps swap the whole catalogue without reloading the document, so
  // the one-shot offer made at document_idle is the only one a visitor ever gets
  // unless in-page routing is watched for as well.
  function installRouteChangeWatcher() {
    window.addEventListener("popstate", handleRouteChange);
    window.addEventListener("hashchange", handleRouteChange);
    globalThis.navigation?.addEventListener?.("navigatesuccess", handleRouteChange);
    window.setInterval(handleRouteChange, ROUTE_POLL_INTERVAL_MS);
  }

  function handleRouteChange() {
    const nextRoute = readRouteKey();
    if (nextRoute === currentRoute) return;
    currentRoute = nextRoute;
    // Converted pages are already watched: their observer resets detection and
    // rescans on its own, and re-offering over live conversions would be noise.
    if (CurrencyPageConverter.hasConversions()) return;
    CurrencyDetector.resetPageCurrencyDetection();
    CurrencyPageUi.removePageConvertPrompt();
    queueSettingsTask(() => applySitePreference(pageCommandGeneration));
  }

  // Hash-routed apps put a path after "#/", while a plain "#section" anchor is
  // not a navigation and must not re-offer the prompt.
  function readRouteKey() {
    const { pathname, search, hash } = window.location;
    return `${pathname}${search}${hash.startsWith("#/") ? hash : ""}`;
  }

  function handleMessage(message) {
    switch (message?.type) {
      case M.RUN_SITE_CONVERSION: {
        const commandGeneration = pageCommandGeneration;
        return queueSettingsTask(async () => {
          if (commandGeneration !== pageCommandGeneration) return cancelledCommandResult();
          const refreshed = await refreshSettingsForCommand();
          if (!refreshed) {
            return { ok: false, error: t("error.refreshSettings") };
          }
          if (commandGeneration !== pageCommandGeneration) return cancelledCommandResult();
          const result = await runSiteConversion();
          if (commandGeneration !== pageCommandGeneration) return cancelledCommandResult();
          CurrencyPageUi.removePageConvertPrompt();
          if (!result?.cancelled) showConversionResult(result);
          return result;
        });
      }
      case M.CLEAR_SITE_CONVERSION:
        return clearSiteConversion({
          forgetSite: message.forgetSite,
          suppressPrompt: message.suppressPrompt
        });
      case M.SHOW_CONVERT_PROMPT: {
        const commandGeneration = pageCommandGeneration;
        return ensureSettingsLoaded().then(async () => {
          if (
            commandGeneration === pageCommandGeneration &&
            !CurrencyPageConverter.hasConversions()
          ) {
            await applySitePreference(commandGeneration);
          }
          return { ok: true };
        });
      }
      case M.CONVERT_SELECTION:
        return ensureSettingsLoaded().then(convertCurrentSelection);
      default:
        return null;
    }
  }

  function ensureSettingsLoaded() {
    return settingsLoadPromise || Promise.resolve();
  }

  function queueSettingsReload({ failClosed = false } = {}) {
    const reloadGeneration = pageCommandGeneration;
    return queueSettingsTask(() => loadSettings(reloadGeneration, { failClosed }));
  }

  function queueSettingsTask(task) {
    const pendingTask = settingsLoadPromise || Promise.resolve();
    const nextTask = pendingTask.catch(() => {}).then(task);
    settingsLoadPromise = nextTask.then(() => undefined, () => undefined);
    return nextTask;
  }

  function invalidatePendingPageCommands() {
    pageCommandGeneration += 1;
    CurrencyPageConverter.cancelPendingConversion();
    CurrencyPageConverter.stopWatching();
    CurrencyPageConverter.stopDiscovering();
  }

  function cancelledCommandResult() {
    return {
      ok: false,
      count: 0,
      cancelled: true,
      error: t("error.cancelledBeforeUpdate")
    };
  }

  async function loadSettings(reloadGeneration, { failClosed = false } = {}) {
    const previousSettings = settings;
    let result;
    try {
      result = await ExtensionAPI.runtime.sendMessage({ type: M.GET_SETTINGS });
    } catch (_error) {
      if (failClosed) await failClosedSettingsReload(reloadGeneration);
      return;
    }
    if (!result?.ok) {
      if (failClosed) await failClosedSettingsReload(reloadGeneration);
      return;
    }
    const hadConversions = CurrencyPageConverter.hasConversions();
    const settingsChanges = adoptSettings(result.settings, previousSettings);
    if (reloadGeneration !== pageCommandGeneration) return;
    if (
      settingsChanges.languageChanged &&
      !settingsChanges.rateSettingsChanged &&
      !settingsChanges.presentationSettingsChanged &&
      !settingsChanges.pagePromptChanged
    ) {
      CurrencyPageUi.refreshLanguage();
      return;
    }
    const renderedSettingsChanged = hadConversions &&
      renderedConversionSettingsKey !== null &&
      renderedConversionSettingsKey !== conversionSettingsKey(settings);

    if (hadConversions && settings.enabled) {
      if (settingsChanges.rateSettingsChanged || renderedSettingsChanged) {
        CurrencyPageUi.clearTransientUi();
        CurrencyPageUi.removePageConvertPrompt();
        const conversionResult = await runSiteConversion();
        if (reloadGeneration !== pageCommandGeneration || conversionResult?.cancelled) return;
        if (conversionResult?.ok) showConversionResult(conversionResult);
        else {
          CurrencyPageUi.showToast(t("toast.reconvertFailed", {
            detail: conversionResult?.error || t("toast.tryConvertAgain")
          }));
        }
      } else {
        CurrencyPageConverter.startWatching();
        if (!settings.showPagePrompt) CurrencyPageUi.removePageConvertPrompt();
      }
      return;
    }

    if (
      !settingsChanges.rateSettingsChanged &&
      settingsChanges.presentationSettingsChanged &&
      !settingsChanges.pagePromptChanged
    ) return;

    clearRenderedConversions();
    CurrencyPageUi.clearTransientUi();
    CurrencyPageUi.removePageConvertPrompt();

    if (settings.enabled) await applySitePreference(reloadGeneration);
    else {
      await updateBadge(0);
      CurrencyPageUi.removePageConvertPrompt();
    }
  }

  async function refreshSettingsForCommand() {
    const result = await ExtensionAPI.runtime.sendMessage({ type: M.GET_SETTINGS });
    if (!result?.ok) return false;
    const previousSettings = settings;
    adoptSettings(result.settings, previousSettings);
    if (!settings.enabled) {
      clearRenderedConversions();
      CurrencyPageUi.clearTransientUi();
      CurrencyPageUi.removePageConvertPrompt();
      await updateBadge(0);
    }
    return true;
  }

  function adoptSettings(nextSettings, previousSettings) {
    settings = nextSettings;
    CurrencyI18n.setLanguage(settings.language);
    const languageChanged = !previousSettings || previousSettings.language !== settings.language;
    const rateSettingsChanged = !previousSettings || CurrencySettings.RATE_AFFECTING_KEYS.some(
      (key) => previousSettings[key] !== settings[key]
    );
    const presentationSettingsChanged = !previousSettings || CurrencySettings.PRESENTATION_KEYS.some(
      (key) => previousSettings[key] !== settings[key]
    );
    const pagePromptChanged = !previousSettings ||
      previousSettings.showPagePrompt !== settings.showPagePrompt;
    if (rateSettingsChanged) {
      CurrencyDetector.resetPageCurrencyDetection();
      CurrencyPageConverter.configure(settings);
    } else if (presentationSettingsChanged) {
      CurrencyPageConverter.updatePresentation(settings);
    }
    CurrencyPageUi.configure({
      settings,
      runConversion: runSiteConversion,
      clearConversion: clearPromptConversion,
      convertSelection: convertSelectionText
    });
    return { rateSettingsChanged, presentationSettingsChanged, pagePromptChanged, languageChanged };
  }

  async function applySitePreference(expectedGeneration = pageCommandGeneration) {
    if (expectedGeneration !== pageCommandGeneration) return;
    if (!settings?.enabled) {
      CurrencyPageUi.removePageConvertPrompt();
      CurrencyPageConverter.stopWatching();
      CurrencyPageConverter.stopDiscovering();
      return;
    }

    if (CurrencyPageConverter.hasConversions()) {
      CurrencyPageConverter.stopDiscovering();
      CurrencyPageConverter.startWatching();
      if (!settings.showPagePrompt) CurrencyPageUi.removePageConvertPrompt();
      return;
    }

    const status = await getSiteStatus();
    if (expectedGeneration !== pageCommandGeneration) return;
    if (status?.remembered) {
      CurrencyPageConverter.stopDiscovering();
      CurrencyPageUi.removePageConvertPrompt();
      const result = await runSiteConversion();
      if (expectedGeneration !== pageCommandGeneration || result?.cancelled) return;
      if (!result?.ok) {
        if (settings.showPagePrompt) CurrencyPageUi.showPageConvertPrompt();
        if (result?.detectionConfidence !== "low") showConversionResult(result);
      }
    } else if (settings.showPagePrompt) {
      CurrencyPageConverter.stopWatching();
      await updateBadge(0);
      if (expectedGeneration !== pageCommandGeneration) return;
      offerPageConversion(expectedGeneration);
    } else {
      CurrencyPageConverter.stopWatching();
      CurrencyPageConverter.stopDiscovering();
      await updateBadge(0);
      if (expectedGeneration !== pageCommandGeneration) return;
      CurrencyPageUi.removePageConvertPrompt();
    }
  }

  // Rates are prefetched for the prompt anyway; once they land, tell the prompt
  // what the conversion would give so the offer is informed rather than blind.
  function showPromptRateWhenReady(currencies, expectedGeneration) {
    const base = [...new Set(currencies || [])]
      .find((currency) => currency && currency !== settings?.toCurrency);
    CurrencyPageConverter.prefetchRates(currencies)
      .then(() => {
        if (expectedGeneration !== pageCommandGeneration || !base) return;
        CurrencyPageUi.setPageConvertPromptRate(CurrencyPageConverter.describeRate(base));
      })
      .catch(() => {});
  }

  function offerPageConversion(expectedGeneration = pageCommandGeneration) {
    if (
      expectedGeneration !== pageCommandGeneration ||
      !settings?.enabled ||
      !settings.showPagePrompt ||
      CurrencyPageConverter.hasConversions()
    ) return;

    const detection = CurrencyPageConverter.detectPagePrices();
    if (detection.found) {
      CurrencyPageConverter.stopDiscovering();
      CurrencyPageUi.showPageConvertPrompt();
      showPromptRateWhenReady(detection.currencies, expectedGeneration);
      return;
    }

    CurrencyPageUi.removePageConvertPrompt();
    CurrencyPageConverter.startDiscovering((nextDetection) => {
      if (
        expectedGeneration !== pageCommandGeneration ||
        !settings?.enabled ||
        !settings.showPagePrompt ||
        CurrencyPageConverter.hasConversions()
      ) return;
      CurrencyPageUi.showPageConvertPrompt();
      showPromptRateWhenReady(nextDetection.currencies, expectedGeneration);
    });
  }

  async function runSiteConversion() {
    CurrencyPageConverter.stopDiscovering();
    const runSettingsKey = conversionSettingsKey(settings);
    const result = await CurrencyPageConverter.runSiteConversion({ clearExisting: true, observe: true });
    if (!result?.cancelled) {
      renderedConversionSettingsKey = CurrencyPageConverter.hasConversions()
        ? runSettingsKey
        : null;
    } else {
      renderedConversionSettingsKey = null;
    }
    await updateBadge(result?.ok ? result.count : 0);
    if (result?.ok && result.count > 0) recordSuccess();
    return result;
  }

  async function convertSelectionText(text, element) {
    const result = await CurrencyPageConverter.convertSelectionText(text, element);
    if (result?.ok) recordSuccess();
    return result;
  }

  async function refreshRenderedConversionsForRates() {
    if (!settings?.enabled || !CurrencyPageConverter.hasConversions()) return;
    CurrencyPageConverter.configure(settings);
    const result = await runSiteConversion();
    if (!result?.ok && !result?.cancelled) {
      CurrencyPageUi.showToast(t("toast.ratesRefreshFailed", {
        detail: result?.error || t("toast.tryConvertAgain")
      }));
    }
  }

  async function clearSiteConversion({ forgetSite = false, suppressPrompt = false } = {}) {
    invalidatePendingPageCommands();
    clearRenderedConversions();
    await updateBadge(0);
    CurrencyPageUi.clearTransientUi();
    if (forgetSite) {
      const result = await ExtensionAPI.runtime.sendMessage({
        type: M.FORGET_SITE,
        origin: getCurrentOrigin()
      });
      if (!result?.ok) return result || { ok: false, error: t("error.siteAccess") };
    }
    if (settings?.enabled && settings.showPagePrompt && !suppressPrompt && !forgetSite) {
      CurrencyPageUi.showPageConvertPrompt();
    } else CurrencyPageUi.removePageConvertPrompt();
    return { ok: true };
  }

  async function clearPromptConversion() {
    invalidatePendingPageCommands();
    clearRenderedConversions();
    await updateBadge(0);
    return { ok: true };
  }

  function clearRenderedConversions() {
    CurrencyPageConverter.clearConversions();
    renderedConversionSettingsKey = null;
  }

  function conversionSettingsKey(value) {
    return JSON.stringify(CurrencySettings.RATE_AFFECTING_KEYS.map((key) => value?.[key]));
  }

  async function failClosedSettingsReload(reloadGeneration) {
    if (reloadGeneration !== pageCommandGeneration) return;
    const disabledSettings = {
      ...CurrencySettings.DEFAULTS,
      ...settings,
      enabled: false,
      showPagePrompt: false
    };
    adoptSettings(disabledSettings, settings);
    clearRenderedConversions();
    CurrencyPageUi.clearTransientUi();
    CurrencyPageUi.removePageConvertPrompt();
    await updateBadge(0);
  }

  function getSiteStatus() {
    return ExtensionAPI.runtime.sendMessage({ type: M.GET_SITE_STATUS, origin: getCurrentOrigin() });
  }

  function getCurrentOrigin() {
    return /^https?:$/.test(window.location.protocol) ? window.location.origin : window.location.href;
  }

  function changeAffectsCurrentOrigin(change) {
    const origin = getCurrentOrigin();
    return change?.oldValue?.[origin] !== change?.newValue?.[origin];
  }

  function sitePreferenceWasRemovedFromCurrentOrigin(change) {
    const origin = getCurrentOrigin();
    return change?.oldValue?.[origin] === true && change?.newValue?.[origin] !== true;
  }

  async function convertCurrentSelection() {
    if (!settings?.enabled) {
      CurrencyPageUi.showToast(t("toast.turnOnFirst"));
      return { ok: false, error: t("error.off") };
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      CurrencyPageUi.showToast(t("toast.selectPrice"));
      return { ok: false, error: t("error.noSelection") };
    }

    const text = selection.toString().trim();
    const result = await convertSelectionText(text, selection.anchorNode?.parentElement);
    const stale = result?.staleRates
      ? ` ${t(result.cacheAgeLabel ? "rate.cachedAge" : "rate.cached", { age: result.cacheAgeLabel })}`
      : "";
    CurrencyPageUi.showToast(
      result?.ok
        ? `${text} (${result.sourceCurrency}) = ${result.converted}.${stale}`
        : result?.error || t("toast.selectionFailed")
    );
    return result;
  }

  function showConversionResult(result) {
    if (result?.ok && result.count > 0) {
      const detected = settings.fromCurrency === "AUTO"
        ? ` ${t("toast.detected", { currencies: result.detectedCurrencies })}`
        : "";
      const rateLine = result.rateProvider
        ? t("toast.rateVia", { date: result.rateDate, provider: result.rateProvider })
        : t("toast.rate", { date: result.rateDate });
      const cached = result.staleRates
        ? ` (${t(result.cacheAgeLabel ? "toast.cachedSuffixAge" : "toast.cachedSuffix", {
          age: result.cacheAgeLabel
        })})`
        : "";
      const rate = result.rateDate ? ` ${rateLine}${cached}.` : "";
      const scan = result.scanLimited ? ` ${t("toast.scanLimited")}` : "";
      CurrencyPageUi.showToast(
        `${t("toast.converted", { count: result.count })}${detected}${rate}${scan}`,
        {
          actionLabel: t("page.prompt.undo"),
          onAction: () => clearSiteConversion({ suppressPrompt: true }),
          duration: 8000
        }
      );
    } else {
      CurrencyPageUi.showToast(result?.error || t("toast.noPrices"));
    }
  }

  function updateBadge(count) {
    return ExtensionAPI.runtime.sendMessage({ type: M.SET_BADGE, count }).catch(() => {});
  }

  // One page counts as one use, however often it is converted again, so the
  // rating reminder waits for pages where the extension actually helped.
  function recordSuccess() {
    if (successRecorded) return;
    successRecorded = true;
    ExtensionAPI.runtime.sendMessage({ type: M.RECORD_SUCCESS }).catch(() => {});
  }
})();
