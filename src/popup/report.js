// Firefox only. A press on "Report this website" in a web page cannot show
// Firefox's consent prompt, so the background opens this small window, whose
// button can. After one yes, later reports go straight out from the page.
(function initializeReportPage() {
  const M = CurrencyMessages;
  const I18n = CurrencyI18n;
  const t = (key, params) => I18n.t(key, params);
  const CONSENT = Object.freeze({ data_collection: ["browsingActivity"] });
  const params = new URLSearchParams(window.location.search);
  const site = params.get("site") || "";
  const reason = params.get("reason") || "failed";
  const messageNode = document.getElementById("reportMessage");
  const sendButton = document.getElementById("reportSend");
  const cancelButton = document.getElementById("reportCancel");
  const statusNode = document.getElementById("reportStatus");
  let toCurrency = null;

  I18n.setLanguage("auto");
  render();
  ExtensionAPI.runtime.sendMessage({ type: M.GET_SETTINGS })
    .then((reply) => {
      if (reply?.settings?.language) I18n.setLanguage(reply.settings.language);
      toCurrency = reply?.settings?.toCurrency || null;
    })
    .catch(() => {})
    .finally(() => {
      render();
      sendButton.disabled = !site;
    });

  function render() {
    document.documentElement.lang = I18n.language();
    I18n.apply(document);
    messageNode.textContent = t("page.report.consentMessage", { site });
  }

  sendButton.addEventListener("click", async () => {
    // Asked first, inside the click, or Firefox will not show its prompt.
    const consent = ExtensionAPI.permissions.request(CONSENT).catch(() => false);
    sendButton.disabled = true;
    sendButton.textContent = t("page.report.sending");
    statusNode.textContent = "";
    delete statusNode.dataset.kind;
    const granted = await consent;
    let result = null;
    if (granted) {
      try {
        result = I18n.localize(await ExtensionAPI.runtime.sendMessage({
          type: M.REPORT_SITE,
          origin: `https://${site}`,
          reason,
          to: toCurrency,
          language: I18n.language()
        }));
      } catch (_error) {
        result = null;
      }
    }
    if (result?.ok) {
      sendButton.hidden = true;
      cancelButton.textContent = t("page.report.close");
      statusNode.textContent = t("page.report.sent");
      statusNode.dataset.kind = "success";
      window.setTimeout(() => window.close(), 2500);
      return;
    }
    sendButton.disabled = false;
    sendButton.textContent = t("page.report.send");
    statusNode.textContent = granted
      ? result?.error || t("error.reportFailed")
      : t("error.reportDeclined");
    statusNode.dataset.kind = "error";
  });

  cancelButton.addEventListener("click", () => window.close());
})();
