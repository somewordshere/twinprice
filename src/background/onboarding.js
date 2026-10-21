(function initializeOnboarding(global) {
  const ONBOARDING_PAGE = "onboarding/onboarding.html";

  function createOnboardingService({
    api,
    contentScriptResources = global.CurrencyContentScriptResources,
    i18n = global.CurrencyI18n,
    messages = global.CurrencyMessages,
    pageAccess = global.CurrencyPageAccess
  }) {
    const ensureContentScripts = contentScriptResources.createInjector({ api, messages });

    // Only a genuine first install earns a tab. An update or a browser restart
    // reuses the same onInstalled hook and must stay silent.
    async function openOnInstall(details) {
      if (details?.reason !== "install") return { ok: true, opened: false };
      await api.tabs.create({ url: api.runtime.getURL(ONBOARDING_PAGE) });
      return { ok: true, opened: true };
    }

    // Uninstalling opens a plain thank-you page with ways to say what went wrong,
    // in the language the popup uses. English sits at the website's root and every
    // other language in its own folder. The language is all the address carries:
    // nothing else about the user or their browsing.
    function uninstallPage(languagePreference) {
      return i18n.websiteUrl(i18n.resolve(languagePreference), "goodbye/");
    }

    async function setUninstallPage(languagePreference) {
      await api.runtime.setUninstallURL(uninstallPage(languagePreference));
      return { ok: true };
    }

    // Declared content scripts only reach documents loaded after the install, so
    // every tab already open is inert until it reloads. That is why a new user
    // watches the extension do nothing on the very page they installed it for.
    async function activateOpenTabs() {
      let tabs;
      try {
        if (!await api.permissions.contains({ origins: ["http://*/*", "https://*/*"] })) {
          return {
            ok: false,
            error: "Allow site access using Activate my open tabs, then try again.",
            errorKey: "onboarding.tabsNeedAccess"
          };
        }
        tabs = await api.tabs.query({});
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }

      let activated = 0;
      let skipped = 0;
      for (const tab of tabs) {
        if (tab.url?.startsWith(api.runtime.getURL(""))) continue;
        if (!tab?.id || pageAccess.unsupportedPageMessage(tab.url)) {
          skipped += 1;
          continue;
        }
        try {
          await ensureContentScripts(tab.id);
          activated += 1;
        } catch (_error) {
          // A tab that refuses injection is not worth failing the whole sweep for.
          skipped += 1;
        }
      }
      return { ok: true, activated, skipped };
    }

    return Object.freeze({
      ONBOARDING_PAGE,
      uninstallPage,
      openOnInstall,
      setUninstallPage,
      activateOpenTabs
    });
  }

  function errorMessage(error) {
    return error instanceof Error && error.message
      ? error.message
      : String(error || "Unknown browser error");
  }

  global.CurrencyOnboardingService = Object.freeze({
    ...createOnboardingService({ api: global.ExtensionAPI }),
    create: createOnboardingService
  });
})(globalThis);
