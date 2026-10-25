// "Report this website" sends the name of a site that would not convert to
// twinprice.com, which files it as a GitHub issue. Nothing is sent until the user
// presses the button, and only the hostname leaves the browser: never the path,
// the query or anything from the page.
(function initializeSiteReport(global) {
  const ENDPOINT = "https://twinprice.com/api/report";
  const REASONS = Object.freeze(["no-prices", "no-currency", "failed"]);
  const FETCH_TIMEOUT_MS = 8000;
  // Firefox asks for consent before an add-on sends the sites someone visits.
  // It is optional in the manifest, so it is asked the first time, not on install.
  const FIREFOX_CONSENT = Object.freeze({ data_collection: ["browsingActivity"] });
  const CONSENT_PAGE = "popup/report.html";
  const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

  function createSiteReportService({
    api,
    http = global.CurrencyHttp,
    pageAccess = global.CurrencyPageAccess,
    userAgent = global.navigator?.userAgent || ""
  }) {
    function hostnameOf(pageUrl) {
      try {
        const url = new URL(pageUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        const hostname = url.hostname.replace(/\.$/, "").toLowerCase();
        return HOSTNAME.test(hostname) ? hostname : null;
      } catch (_error) {
        return null;
      }
    }

    function browserName() {
      if (pageAccess.isFirefoxBuild()) return "firefox";
      return /\bEdg\//.test(userAgent) ? "edge" : "chrome";
    }

    async function hasConsent() {
      if (!pageAccess.isFirefoxBuild()) return true;
      try {
        return Boolean(await api.permissions.contains(FIREFOX_CONSENT));
      } catch (_error) {
        return false;
      }
    }

    function isExtensionPage(sender) {
      const base = api.runtime.getURL("");
      return typeof sender?.url === "string" && sender.url.startsWith(base);
    }

    // A web page cannot show Firefox's consent prompt, so a press on the page
    // opens a small Twinprice window that can. After one yes, reports go straight out.
    async function openConsentWindow(site, reason) {
      const query = new URLSearchParams({ site, reason }).toString();
      const url = api.runtime.getURL(`${CONSENT_PAGE}?${query}`);
      if (api.windows?.create) {
        await api.windows.create({ url, type: "popup", width: 420, height: 360 });
      } else {
        await api.tabs.create({ url });
      }
    }

    async function report(message, sender) {
      const site = hostnameOf(message?.origin || sender?.url);
      if (!site) {
        return { ok: false, error: "This page cannot be reported.", errorKey: "error.reportPage" };
      }
      const reason = REASONS.includes(message?.reason) ? message.reason : "failed";

      if (!(await hasConsent())) {
        if (isExtensionPage(sender)) {
          return {
            ok: false,
            declined: true,
            error: "The report was not sent. Firefox needs your permission to send the website name.",
            errorKey: "error.reportDeclined"
          };
        }
        await openConsentWindow(site, reason);
        return { ok: false, consentWindow: true };
      }

      const body = {
        site,
        reason,
        version: api.runtime.getManifest().version,
        browser: browserName(),
        to: typeof message?.to === "string" ? message.to : null,
        language: typeof message?.language === "string" ? message.language : null
      };
      let response;
      try {
        response = await http.fetchWithTimeout(ENDPOINT, FETCH_TIMEOUT_MS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "omit",
          referrerPolicy: "no-referrer"
        });
      } catch (_error) {
        return failure();
      }
      if (response.ok) return { ok: true, site };
      if (response.status === 429) {
        return {
          ok: false,
          error: "Too many reports in a short time. Try again in a minute.",
          errorKey: "error.reportLimited"
        };
      }
      return failure();
    }

    function failure() {
      return {
        ok: false,
        error: "The report could not be sent. Check your connection and try again.",
        errorKey: "error.reportFailed"
      };
    }

    return Object.freeze({ report, hasConsent, hostnameOf });
  }

  global.CurrencySiteReport = Object.freeze({
    ...createSiteReportService({ api: global.ExtensionAPI }),
    create: createSiteReportService,
    ENDPOINT,
    FIREFOX_CONSENT
  });
})(globalThis);
