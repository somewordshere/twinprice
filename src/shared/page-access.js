(function initializePageAccess(global) {
  const FIREFOX_RESTRICTED_HOSTS = new Set([
    "accounts-static.cdn.mozilla.net",
    "accounts.firefox.com",
    "addons.cdn.mozilla.net",
    "addons.mozilla.org",
    "api.accounts.firefox.com",
    "content.cdn.mozilla.net",
    "discovery.addons.mozilla.org",
    "install.mozilla.org",
    "oauth.accounts.firefox.com",
    "profile.accounts.firefox.com",
    "support.mozilla.org",
    "sync.services.mozilla.com"
  ]);

  // The popup loads the translator; the background does not, and keeps English.
  function text(key, fallback, params) {
    return global.CurrencyI18n ? global.CurrencyI18n.t(key, params) : fallback;
  }

  function unsupportedPageMessage(urlValue) {
    const url = parseUrl(urlValue);
    if (!url) return text("access.noWebpage", "This tab does not have a webpage that can be converted.");

    if (["file:", "http:", "https:"].includes(url.protocol) && hasPdfPath(url)) {
      return text(
        "access.pdf",
        "Extensions cannot run inside the browser's PDF viewer. Open a regular webpage and try again."
      );
    }
    if (url.protocol === "file:") return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return text(
        "access.browserPage",
        "Extensions cannot run on browser pages, Reader View, PDFs, or other extension pages."
      );
    }
    if (isFirefoxBuild() && FIREFOX_RESTRICTED_HOSTS.has(url.hostname.toLowerCase())) {
      return text(
        "access.firefoxProtected",
        "Firefox protects this Mozilla page from extensions. Open a regular shopping page and try again."
      );
    }
    return null;
  }

  function describeFailure(tab, error) {
    const unsupported = unsupportedPageMessage(tab?.url);
    if (unsupported) return unsupported;

    const detail = normalizeError(error);
    if (detail) {
      return text("access.startFailed", `Could not start conversion on this page. ${detail}`, { detail });
    }
    return text(
      "access.startFailedReload",
      "Could not start conversion on this page. Reload it once and try again."
    );
  }

  function normalizeError(error) {
    const message = typeof error?.message === "string"
      ? error.message
      : typeof error === "string"
        ? error
        : "";
    return message.trim().replace(/^Error:\s*/i, "");
  }

  function parseUrl(value) {
    try {
      return new URL(value);
    } catch (_error) {
      return null;
    }
  }

  function hasPdfPath(url) {
    let pathname = url.pathname;
    try {
      pathname = decodeURIComponent(pathname);
    } catch (_error) {
      // A malformed escape should fall back to the undecoded pathname.
    }
    return /\.pdf$/i.test(pathname);
  }

  function isFirefoxBuild() {
    try {
      return Boolean(
        global.ExtensionAPI?.runtime?.getManifest?.()?.browser_specific_settings?.gecko
      );
    } catch (_error) {
      return false;
    }
  }

  global.CurrencyPageAccess = Object.freeze({
    describeFailure,
    isFirefoxBuild,
    unsupportedPageMessage
  });
})(globalThis);
