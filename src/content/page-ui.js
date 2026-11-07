(function initializePageUi(global) {
  const t = (key, params) => global.CurrencyI18n.t(key, params);
  let settings = null;
  let pageConvertPrompt = null;
  let pageConvertButton = null;
  let pageConvertMessage = null;
  let pageConvertRate = null;
  let pagePromptAction = "convert";
  let pagePromptIdle = true;
  let pagePromptRate = null;
  let pageConvertClose = null;
  let pagePromptPreviousFocus = null;
  let pagePromptTimer = null;
  let pagePromptPointerInside = false;
  // The offer leaves on its own after this long; the popup and the keyboard
  // shortcut still convert the page.
  const PAGE_PROMPT_DURATION_MS = 6000;
  let pageReportRow = null;
  let pageReportButton = null;
  let pageReportNote = null;
  let pageReportReason = null;
  let selectionPopup = null;
  let pendingSelectionText = "";
  let pendingSelectionSourceCurrency = "";
  let selectionPreviousFocus = null;
  let selectionWasKeyboardTriggered = false;
  let selectionDismissTimer = null;
  let runConversion = null;
  let clearConversion = null;
  let convertSelection = null;
  let reportSite = null;
  let listenersInstalled = false;
  let toastNode = null;
  let toastPreviousFocus = null;
  let toastTimer = null;
  let reviewRequestNode = null;
  let reviewRequestTimer = null;
  const REVIEW_REQUEST_DURATION_MS = 15000;
  // Long enough for the rating ask's fade-out, which is 320ms; it is removed then
  // even where animations are off and animationend never comes.
  const REVIEW_REQUEST_LEAVE_MS = 400;
  const NOTICE_TOP_PX = 16;
  const NOTICE_GAP_PX = 8;
  let noticeSizeObserver = null;

  // A countdown that only runs while the tab is on screen. Shoppers open products
  // in background tabs and look at them later; an ordinary timer would close a
  // notice there before anyone saw it. Hidden, it pauses and keeps what is left;
  // shown again, it carries on.
  function visibleCountdown(durationMs, onDone) {
    let remaining = durationMs;
    let timer = null;
    let startedAt = 0;
    let stopped = false;
    const isHidden = () => document.visibilityState === "hidden";
    function run() {
      if (stopped || timer || isHidden()) return;
      startedAt = Date.now();
      timer = window.setTimeout(() => {
        timer = null;
        stop();
        onDone();
      }, remaining);
    }
    function pause() {
      if (!timer) return;
      window.clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
    }
    function onVisibilityChange() {
      if (isHidden()) pause();
      else run();
    }
    function stop() {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    run();
    return { stop };
  }

  // Runs show() now if the tab is on screen, otherwise the first time it is.
  function whenVisible(show) {
    if (document.visibilityState !== "hidden") {
      show();
      return;
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") return;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      show();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  function isolateControls(element) {
    // Page-level delegated handlers must not treat extension controls as shop
    // buttons. Preserve focus and keyboard defaults, but contain their events.
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "keydown", "keyup"]) {
      element.addEventListener(type, (event) => {
        event.stopPropagation();
        if (type === "click") event.preventDefault();
      });
    }
  }

  function configure(options) {
    settings = options.settings;
    runConversion = options.runConversion;
    clearConversion = options.clearConversion;
    convertSelection = options.convertSelection;
    reportSite = options.reportSite;
  }

  function installSelectionListeners() {
    if (listenersInstalled) return;
    listenersInstalled = true;
    document.addEventListener("mouseup", handleTextSelection);
    document.addEventListener("keyup", handleKeyboardSelection);
    document.addEventListener("mousedown", handleOutsideSelectionPopup);
    window.addEventListener("scroll", () => removeSelectionPopup({ restoreFocus: false }), true);
  }

  function showPageConvertPrompt() {
    if (pageConvertPrompt && !pageConvertPrompt.isConnected) {
      pageConvertPrompt = null;
      pageConvertButton = null;
      pageConvertMessage = null;
      pageConvertRate = null;
      pageConvertClose = null;
      pagePromptPreviousFocus = null;
      clearReportRefs();
    }
    if (pageConvertPrompt || !settings?.enabled || !document.body || window.top !== window) return;
    pagePromptPreviousFocus = getActiveElementForRestore();
    pagePromptAction = "convert";
    pagePromptIdle = true;
    pagePromptRate = null;
    pageConvertPrompt = document.createElement("aside");
    isolateControls(pageConvertPrompt);
    pageConvertPrompt.className = "ccp-page-prompt";
    pageConvertPrompt.lang = global.CurrencyI18n.language();
    pageConvertPrompt.setAttribute("aria-labelledby", "ccp-page-prompt-title");
    pageConvertPrompt.setAttribute(
      "aria-describedby",
      "ccp-page-prompt-message ccp-page-prompt-rate"
    );

    const header = document.createElement("div");
    header.className = "ccp-page-prompt-header";
    const title = document.createElement("strong");
    title.id = "ccp-page-prompt-title";
    title.className = "ccp-page-prompt-title";
    title.textContent = "Twinprice";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "ccp-page-prompt-close";
    close.textContent = "×";
    close.setAttribute("aria-label", t("page.dismiss"));
    close.addEventListener("click", () => removePageConvertPrompt());
    pageConvertClose = close;
    header.append(title, close);

    pageConvertMessage = document.createElement("span");
    pageConvertMessage.id = "ccp-page-prompt-message";
    pageConvertMessage.className = "ccp-page-prompt-message";
    pageConvertMessage.setAttribute("role", "status");
    pageConvertMessage.setAttribute("aria-live", "polite");
    pageConvertMessage.setAttribute("aria-atomic", "true");
    pageConvertMessage.textContent = t("page.prompt.message", { currency: settings.toCurrency });

    // Shown once the rate is known, so the offer states what you would get
    // before you accept it. Not a live region: the message beside it already is.
    pageConvertRate = document.createElement("span");
    pageConvertRate.id = "ccp-page-prompt-rate";
    pageConvertRate.className = "ccp-page-prompt-rate";
    pageConvertRate.hidden = true;

    pageConvertButton = document.createElement("button");
    pageConvertButton.type = "button";
    pageConvertButton.className = "ccp-page-prompt-action";
    pageConvertButton.textContent = t("page.prompt.convert");
    pageConvertButton.addEventListener("click", handlePagePromptAction);

    // Offered only after a conversion fails, so a website that does not work can
    // be sent to twinprice.com in one press. The note says what is sent.
    pageReportRow = document.createElement("div");
    pageReportRow.className = "ccp-page-prompt-report";
    pageReportRow.hidden = true;
    pageReportButton = document.createElement("button");
    pageReportButton.type = "button";
    pageReportButton.className = "ccp-page-prompt-report-action";
    pageReportButton.textContent = t("page.report.action");
    pageReportButton.addEventListener("click", handlePageReportAction);
    pageReportNote = document.createElement("span");
    pageReportNote.className = "ccp-page-prompt-report-note";
    pageReportNote.setAttribute("role", "status");
    pageReportNote.setAttribute("aria-live", "polite");
    pageReportRow.append(pageReportButton, pageReportNote);

    pageConvertPrompt.append(
      header,
      pageConvertMessage,
      pageConvertRate,
      pageConvertButton,
      pageReportRow
    );
    pageConvertPrompt.addEventListener("keydown", handlePagePromptKeydown);
    // Someone pointing at the offer or tabbing through it is about to use it, so
    // the countdown waits for them and starts over when they move away.
    pageConvertPrompt.addEventListener("pointerenter", () => {
      pagePromptPointerInside = true;
      cancelPagePromptDismissal();
    });
    pageConvertPrompt.addEventListener("pointerleave", () => {
      pagePromptPointerInside = false;
      schedulePagePromptDismissal();
    });
    pageConvertPrompt.addEventListener("focusin", cancelPagePromptDismissal);
    pageConvertPrompt.addEventListener("focusout", (event) => {
      if (!pageConvertPrompt?.contains(event.relatedTarget)) schedulePagePromptDismissal();
    });
    pagePromptPointerInside = false;
    document.body.appendChild(pageConvertPrompt);
    trackNoticeSize(pageConvertPrompt);
    placeNotices();
    schedulePagePromptDismissal();
  }

  // Everything Twinprice says on a page stacks down from the top-right corner:
  // the convert offer, then the notice, then the rating ask, 8px apart. Heights
  // change as messages change, so a size observer keeps the stack in step.
  function placeNotices() {
    let top = NOTICE_TOP_PX;
    for (const node of [pageConvertPrompt, toastNode, reviewRequestNode]) {
      if (!node?.isConnected) continue;
      node.style.setProperty("top", `${top}px`, "important");
      top += node.offsetHeight + NOTICE_GAP_PX;
    }
  }

  function trackNoticeSize(node) {
    if (typeof ResizeObserver !== "function") return;
    noticeSizeObserver ||= new ResizeObserver(() => placeNotices());
    noticeSizeObserver.observe(node);
  }

  function untrackNoticeSize(node) {
    if (node) noticeSizeObserver?.unobserve(node);
  }

  // A notice is placed before it may glide, so it appears where it belongs and
  // only moves later, when something above it leaves.
  function settleNotice(node) {
    window.requestAnimationFrame(() => {
      if (node.isConnected) node.dataset.ccpSettled = "";
    });
  }

  // Only the untouched offer times out, and only while its tab is on screen. Once
  // Convert is pressed the prompt shows progress, then the result with Undo or an
  // error, and stays until closed.
  function schedulePagePromptDismissal() {
    cancelPagePromptDismissal();
    const prompt = pageConvertPrompt;
    if (!prompt || !pagePromptIdle || pagePromptPointerInside) return;
    if (prompt.contains(document.activeElement)) return;
    pagePromptTimer = visibleCountdown(PAGE_PROMPT_DURATION_MS, () => {
      pagePromptTimer = null;
      if (pageConvertPrompt === prompt && pagePromptIdle) removePageConvertPrompt({ restoreFocus: false });
    });
  }

  function cancelPagePromptDismissal() {
    pagePromptTimer?.stop();
    pagePromptTimer = null;
  }

  function setPageConvertPromptRate(descriptor) {
    if (!pageConvertRate) return;
    pagePromptRate = descriptor || null;
    if (!descriptor || !Number.isFinite(descriptor.rate)) {
      pageConvertRate.textContent = "";
      pageConvertRate.hidden = true;
      return;
    }
    // Deliberately terse: this card is 268px wide and a full freshness phrase
    // wraps to a second line. The popup and toast carry the detail.
    const freshness = descriptor.stale ? t("page.rate.cached") : descriptor.date || "";
    pageConvertRate.textContent = `1 ${descriptor.base} = ${
      global.CurrencyI18n.formatRate(descriptor.rate)
    } ${descriptor.quote}${freshness ? ` · ${freshness}` : ""}`;
    pageConvertRate.title = descriptor.stale && descriptor.cacheAgeLabel
      ? t("page.rate.cachedTitle", { age: descriptor.cacheAgeLabel })
      : "";
    pageConvertRate.hidden = false;
  }

  async function handlePagePromptAction() {
    if (!pageConvertPrompt || !pageConvertButton || !pageConvertMessage) return;
    const prompt = pageConvertPrompt;
    pagePromptIdle = false;
    cancelPagePromptDismissal();
    hideReportOption();
    if (pagePromptAction === "undo") {
      pageConvertButton.disabled = true;
      pageConvertButton.textContent = t("page.prompt.restoring");
      pageConvertMessage.textContent = t("page.prompt.restoringMessage");
      let result;
      try {
        result = await clearConversion?.();
      } catch (error) {
        if (pageConvertPrompt !== prompt || !pageConvertButton || !pageConvertMessage) return;
        pageConvertButton.disabled = false;
        pageConvertButton.textContent = t("page.prompt.tryUndo");
        pageConvertMessage.textContent = formatActionFailure(
          error,
          t("page.prompt.undoFailed")
        );
        pageConvertPrompt.dataset.state = "error";
        return;
      }
      if (pageConvertPrompt !== prompt || !pageConvertButton || !pageConvertMessage) return;
      pageConvertButton.disabled = false;
      if (result?.ok === false) {
        pageConvertButton.textContent = t("page.prompt.tryUndo");
        pageConvertMessage.textContent = result.error || t("page.prompt.undoFailedFull");
        pageConvertPrompt.dataset.state = "error";
        return;
      }
      pagePromptAction = "convert";
      pageConvertButton.textContent = t("page.prompt.convertAgain");
      pageConvertMessage.textContent = t("page.prompt.restored");
      delete pageConvertPrompt.dataset.state;
      return;
    }

    pageConvertButton.disabled = true;
    pageConvertButton.textContent = t("page.prompt.converting");
    pageConvertMessage.textContent = t("page.prompt.scanning");
    delete pageConvertPrompt.dataset.state;
    let result;
    try {
      result = await runConversion();
    } catch (error) {
      if (pageConvertPrompt !== prompt || !pageConvertButton || !pageConvertMessage) return;
      pagePromptAction = "convert";
      pageConvertButton.disabled = false;
      pageConvertButton.textContent = t("page.prompt.tryAgain");
      pageConvertMessage.textContent = formatActionFailure(
        error,
        t("page.prompt.convertFailed")
      );
      pageConvertPrompt.dataset.state = "error";
      showReportOption("failed");
      return;
    }
    if (pageConvertPrompt !== prompt) return;

    if (result?.ok) {
      // A chosen source currency is what every price was converted from, whatever
      // the page itself looks like.
      const source = settings.fromCurrency !== "AUTO"
        ? settings.fromCurrency
        : result.detectedCurrency || result.detectedCurrencies || t("page.prompt.detectedFallback");
      pagePromptAction = "undo";
      pageConvertButton.disabled = false;
      pageConvertButton.textContent = t("page.prompt.undo");
      pageConvertMessage.textContent = t("page.prompt.success", {
        count: result.count,
        source,
        target: settings.toCurrency
      });
      pageConvertPrompt.dataset.state = "success";
    } else {
      pagePromptAction = "convert";
      pageConvertButton.disabled = false;
      pageConvertButton.textContent = t("page.prompt.tryAgain");
      pageConvertMessage.textContent = result?.detectionConfidence === "low"
        ? t("page.prompt.lowConfidence")
        : result?.error || t("page.prompt.genericError");
      pageConvertPrompt.dataset.state = "error";
      showReportOption(result?.reportReason);
    }
  }

  function showReportOption(reason) {
    if (!pageReportRow || !pageReportButton || !pageReportNote) return;
    if (!reason || typeof reportSite !== "function") {
      hideReportOption();
      return;
    }
    pageReportReason = reason;
    pageReportRow.hidden = false;
    pageReportButton.hidden = false;
    pageReportButton.disabled = false;
    pageReportButton.textContent = t("page.report.action");
    pageReportNote.textContent = t("page.report.note", { site: global.location.hostname });
    delete pageReportRow.dataset.state;
  }

  function hideReportOption() {
    if (pageReportRow) pageReportRow.hidden = true;
  }

  async function handlePageReportAction() {
    if (!pageReportButton || !pageReportNote || !pageReportRow) return;
    const button = pageReportButton;
    const hadFocus = document.activeElement === button;
    button.disabled = true;
    button.textContent = t("page.report.sending");
    let result;
    try {
      result = await reportSite(pageReportReason);
    } catch (error) {
      result = { ok: false, error: formatActionFailure(error, t("page.report.failed")) };
    }
    if (pageReportButton !== button || !pageReportNote || !pageReportRow) return;
    button.disabled = false;
    if (result?.ok) {
      button.hidden = true;
      pageReportNote.textContent = t("page.report.sent");
      pageReportRow.dataset.state = "success";
      // The pressed button is gone; keep keyboard focus inside the prompt.
      if (hadFocus) pageConvertButton?.focus({ preventScroll: true });
      return;
    }
    button.textContent = t("page.report.action");
    if (result?.consentWindow) {
      pageReportNote.textContent = t("page.report.confirmWindow");
      pageReportRow.dataset.state = "info";
      return;
    }
    pageReportNote.textContent = result?.error || t("page.report.failed");
    pageReportRow.dataset.state = "error";
  }

  function clearReportRefs() {
    pageReportRow = null;
    pageReportButton = null;
    pageReportNote = null;
    pageReportReason = null;
  }

  // Re-renders the offer in place after the language changes. A prompt that is
  // mid-conversion or showing a result is left alone; it is already on screen.
  function refreshLanguage() {
    if (!pageConvertPrompt || !pagePromptIdle || !settings) return;
    pageConvertPrompt.lang = global.CurrencyI18n.language();
    pageConvertClose?.setAttribute("aria-label", t("page.dismiss"));
    pageConvertMessage.textContent = t("page.prompt.message", { currency: settings.toCurrency });
    pageConvertButton.textContent = t("page.prompt.convert");
    if (pagePromptRate) setPageConvertPromptRate(pagePromptRate);
  }

  function handlePagePromptKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    removePageConvertPrompt();
  }

  function removePageConvertPrompt({ restoreFocus = true } = {}) {
    const shouldRestoreFocus = Boolean(
      restoreFocus && pageConvertPrompt?.contains(document.activeElement)
    );
    cancelPagePromptDismissal();
    pagePromptPointerInside = false;
    untrackNoticeSize(pageConvertPrompt);
    pageConvertPrompt?.remove();
    pageConvertPrompt = null;
    placeNotices();
    pageConvertButton = null;
    pageConvertMessage = null;
    pageConvertRate = null;
    pageConvertClose = null;
    clearReportRefs();
    pagePromptRate = null;
    pagePromptAction = "convert";
    pagePromptIdle = true;
    if (shouldRestoreFocus) restoreFocusTo(pagePromptPreviousFocus);
    pagePromptPreviousFocus = null;
  }

  function handleTextSelection(event) {
    if (!selectionPopup?.contains(event.target)) {
      window.setTimeout(() => showSelectionPopup({ focus: false }), 0);
    }
  }

  function handleKeyboardSelection(event) {
    if (event.key !== "Shift") return;
    window.setTimeout(() => showSelectionPopup({ focus: true }), 0);
  }

  function showSelectionPopup({ focus = false } = {}) {
    const previousFocus = selectionPreviousFocus;
    const activeBeforeRefresh = getActiveElementForRestore();
    const popupHadFocus = Boolean(selectionPopup?.contains(document.activeElement));
    removeSelectionPopup({ restoreFocus: false, preservePreviousFocus: focus });
    if (!settings?.enabled) {
      if (focus && popupHadFocus) restoreFocusTo(previousFocus);
      selectionPreviousFocus = null;
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (focus && popupHadFocus) restoreFocusTo(previousFocus);
      selectionPreviousFocus = null;
      return;
    }
    const selectedText = selection.toString().trim();
    const matches = CurrencyDetector.findMatchesForContext(
      selectedText,
      selection.anchorNode?.parentElement,
      settings,
      { selection: true }
    );
    // A price already in the target currency has nothing to convert, but staying
    // silent looks like the feature is broken, so a short notice says why.
    let alreadyInTarget = false;
    if (matches.length === 0) {
      const inTarget = CurrencyDetector.findMatchesForContext(
        selectedText,
        selection.anchorNode?.parentElement,
        settings,
        { selection: true, keepTarget: true }
      );
      alreadyInTarget = inTarget.length === 1 && inTarget[0].currency === settings.toCurrency;
    }
    if (matches.length !== 1 && !alreadyInTarget) {
      if (focus && popupHadFocus) restoreFocusTo(previousFocus);
      selectionPreviousFocus = null;
      return;
    }
    const match = matches[0];

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) {
      if (focus && popupHadFocus) restoreFocusTo(previousFocus);
      selectionPreviousFocus = null;
      return;
    }
    pendingSelectionText = selectedText;
    pendingSelectionSourceCurrency = match ? match.currency : "";
    selectionWasKeyboardTriggered = focus;
    selectionPreviousFocus = focus
      ? previousFocus || (popupHadFocus ? null : activeBeforeRefresh)
      : null;
    selectionPopup = document.createElement("button");
    isolateControls(selectionPopup);
    selectionPopup.type = "button";
    selectionPopup.className = "ccp-selection-popup";
    selectionPopup.lang = global.CurrencyI18n.language();
    selectionPopup.setAttribute("aria-live", "polite");
    selectionPopup.setAttribute("aria-atomic", "true");
    if (alreadyInTarget) {
      const notice = t("page.selection.alreadyTarget", { currency: settings.toCurrency });
      updateSelectionPopup(notice, notice, { state: "info" });
      selectionPopup.setAttribute("aria-disabled", "true");
      selectionDismissTimer = window.setTimeout(
        () => removeSelectionPopup({ restoreFocus: false }),
        4000
      );
    } else {
      updateSelectionPopup(
        t("page.selection.convert"),
        t("page.selection.convertLabel", { source: match.currency, target: settings.toCurrency })
      );
      selectionPopup.addEventListener("click", handleConvertSelectionClick);
    }
    selectionPopup.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    selectionPopup.addEventListener("keydown", handleSelectionPopupKeydown);
    document.body.appendChild(selectionPopup);

    const popupRect = selectionPopup.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - popupRect.width / 2),
      window.innerWidth - popupRect.width - 8
    );
    const preferredTop = rect.bottom + 8;
    const top = preferredTop + popupRect.height <= window.innerHeight
      ? preferredTop
      : Math.max(8, rect.top - popupRect.height - 8);
    selectionPopup.style.left = `${left}px`;
    selectionPopup.style.top = `${top}px`;
    if (focus) selectionPopup.focus({ preventScroll: true });
  }

  async function handleConvertSelectionClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectionPopup || !pendingSelectionText) return;
    const popup = selectionPopup;
    popup.disabled = true;
    updateSelectionPopup(
      t("page.prompt.converting"),
      t("page.selection.convertingLabel", {
        source: pendingSelectionSourceCurrency || t("page.selection.currencyFallback"),
        target: settings.toCurrency
      }),
      { busy: true }
    );
    const selection = window.getSelection();
    let result;
    try {
      result = await convertSelection(
        pendingSelectionText,
        selection?.anchorNode?.parentElement
      );
    } catch (error) {
      result = {
        ok: false,
        error: formatActionFailure(error, t("page.selection.failedSummary"))
      };
    }
    if (selectionPopup !== popup) return;

    popup.disabled = false;
    if (result?.ok) {
      const source = result.sourceCurrency || pendingSelectionSourceCurrency ||
        t("page.selection.currencyFallback");
      const converted = result.converted || settings.toCurrency;
      updateSelectionPopup(
        `${source} → ${converted}`,
        t("page.selection.doneLabel", { source, target: converted }),
        { state: "success" }
      );
    } else {
      const errorMessage = result?.error || t("page.selection.failed");
      updateSelectionPopup(
        errorMessage,
        t("page.selection.failedLabel", { message: errorMessage }),
        { state: "error" }
      );
    }
    if (selectionWasKeyboardTriggered) popup.focus({ preventScroll: true });
    if (!selectionWasKeyboardTriggered) {
      selectionDismissTimer = window.setTimeout(
        () => removeSelectionPopup({ restoreFocus: false }),
        3500
      );
    }
  }

  function updateSelectionPopup(text, accessibleName, { state = "", busy = false } = {}) {
    if (!selectionPopup) return;
    selectionPopup.textContent = text;
    selectionPopup.title = accessibleName;
    selectionPopup.setAttribute("aria-label", accessibleName);
    if (busy) selectionPopup.setAttribute("aria-busy", "true");
    else selectionPopup.removeAttribute("aria-busy");
    if (state) selectionPopup.dataset.state = state;
    else delete selectionPopup.dataset.state;
  }

  function handleSelectionPopupKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    removeSelectionPopup();
  }

  function handleOutsideSelectionPopup(event) {
    if (selectionPopup && !selectionPopup.contains(event.target)) {
      removeSelectionPopup({ restoreFocus: false });
    }
  }

  function removeSelectionPopup({ restoreFocus = true, preservePreviousFocus = false } = {}) {
    const shouldRestoreFocus = Boolean(
      restoreFocus && selectionPopup?.contains(document.activeElement)
    );
    if (selectionDismissTimer) window.clearTimeout(selectionDismissTimer);
    selectionDismissTimer = null;
    selectionPopup?.remove();
    selectionPopup = null;
    pendingSelectionText = "";
    pendingSelectionSourceCurrency = "";
    selectionWasKeyboardTriggered = false;
    if (shouldRestoreFocus) restoreFocusTo(selectionPreviousFocus);
    if (!preservePreviousFocus) selectionPreviousFocus = null;
  }

  function showToast(message, options = {}) {
    removeToast({ restoreFocus: false });
    toastPreviousFocus = getActiveElementForRestore();
    const toast = document.createElement("div");
    isolateControls(toast);
    toast.className = "ccp-toast";
    toast.lang = global.CurrencyI18n.language();
    const text = document.createElement("span");
    text.className = "ccp-toast-message";
    text.setAttribute("role", "status");
    text.setAttribute("aria-live", "polite");
    text.setAttribute("aria-atomic", "true");
    toast.appendChild(text);

    if (options.actionLabel && typeof options.onAction === "function") {
      toast.setAttribute("role", "group");
      toast.setAttribute("aria-label", t("page.toast.group"));
      const action = document.createElement("button");
      action.type = "button";
      action.className = "ccp-toast-action";
      action.textContent = options.actionLabel;
      action.addEventListener("click", async () => {
        // A toast that would dismiss itself stays while its action runs.
        toastTimer?.stop();
        toastTimer = null;
        action.disabled = true;
        action.setAttribute("aria-busy", "true");
        try {
          const result = await options.onAction();
          if (result?.ok === false) {
            throw new Error(
              result.error || t("page.toast.actionIncomplete", { action: options.actionLabel })
            );
          }
          if (toastNode === toast) removeToast();
        } catch (error) {
          if (toastNode !== toast || !toast.isConnected) return;
          action.disabled = false;
          action.removeAttribute("aria-busy");
          toast.dataset.state = "error";
          text.textContent = formatActionFailure(
            error,
            t("page.toast.actionFailed", { action: options.actionLabel })
          );
        }
      });
      toast.appendChild(action);

      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "ccp-toast-dismiss";
      dismiss.textContent = "×";
      dismiss.setAttribute("aria-label", t("page.toast.dismiss"));
      dismiss.addEventListener("click", () => removeToast());
      toast.appendChild(dismiss);
    }

    document.body.appendChild(toast);
    toastNode = toast;
    trackNoticeSize(toast);
    placeNotices();
    settleNotice(toast);
    window.requestAnimationFrame(() => {
      if (toastNode === toast && toast.isConnected) text.textContent = message;
    });
    if (!options.actionLabel || options.autoDismiss) {
      const duration = options.duration || 6000;
      let pointerInside = false;
      // Like the offer, a notice waits while someone points at it or tabs into it,
      // so Undo or Report never vanishes under the cursor, and starts over after.
      const schedule = () => {
        toastTimer?.stop();
        toastTimer = null;
        if (toastNode !== toast || pointerInside || toast.contains(document.activeElement)) return;
        if (toast.querySelector(".ccp-toast-action[aria-busy='true']")) return;
        toastTimer = visibleCountdown(duration, () => {
          toastTimer = null;
          if (toastNode === toast) removeToast({ restoreFocus: false });
        });
      };
      const hold = () => {
        if (toastNode !== toast) return;
        toastTimer?.stop();
        toastTimer = null;
      };
      toast.addEventListener("pointerenter", () => {
        pointerInside = true;
        hold();
      });
      toast.addEventListener("pointerleave", () => {
        pointerInside = false;
        schedule();
      });
      toast.addEventListener("focusin", hold);
      toast.addEventListener("focusout", (event) => {
        if (!toast.contains(event.relatedTarget)) schedule();
      });
      schedule();
    }
  }

  function removeToast({ restoreFocus = true } = {}) {
    const shouldRestoreFocus = Boolean(
      restoreFocus && toastNode?.contains(document.activeElement)
    );
    toastTimer?.stop();
    toastTimer = null;
    untrackNoticeSize(toastNode);
    toastNode?.remove();
    toastNode = null;
    placeNotices();
    if (shouldRestoreFocus) restoreFocusTo(toastPreviousFocus);
    toastPreviousFocus = null;
  }

  // The rating ask is its own notice, stacked below the conversion result rather
  // than replacing it, so the result and its Undo stay where they were. The page
  // that earns the ask may be a background tab converting on its own; the ask
  // waits until that tab is on screen, so it is never spent unseen.
  function showReviewRequest(options) {
    whenVisible(() => renderReviewRequest(options));
  }

  function renderReviewRequest({ onRate, onDismiss }) {
    removeReviewRequest();
    const ask = document.createElement("div");
    isolateControls(ask);
    ask.className = "ccp-toast ccp-review-request";
    ask.lang = global.CurrencyI18n.language();
    ask.setAttribute("role", "group");
    ask.setAttribute("aria-label", t("page.review.message"));
    const text = document.createElement("span");
    text.className = "ccp-toast-message";
    text.setAttribute("role", "status");
    text.setAttribute("aria-live", "polite");
    ask.appendChild(text);

    const rate = document.createElement("button");
    rate.type = "button";
    rate.className = "ccp-toast-action";
    rate.textContent = t("page.review.rate");
    rate.addEventListener("click", async () => {
      rate.disabled = true;
      try {
        const result = await onRate();
        if (result?.ok === false) throw new Error();
        removeReviewRequest({ fade: true });
      } catch (_error) {
        rate.disabled = false;
      }
    });
    ask.appendChild(rate);

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "ccp-toast-dismiss";
    dismiss.textContent = "×";
    dismiss.setAttribute("aria-label", t("page.review.dismiss"));
    dismiss.addEventListener("click", () => {
      removeReviewRequest({ fade: true });
      onDismiss();
    });
    ask.appendChild(dismiss);

    document.body.appendChild(ask);
    reviewRequestNode = ask;
    trackNoticeSize(ask);
    placeNotices();
    settleNotice(ask);
    window.requestAnimationFrame(() => {
      if (reviewRequestNode === ask) text.textContent = t("page.review.message");
    });
    // Unanswered, it leaves on its own after 15 seconds on screen; the popup keeps
    // the same offer.
    reviewRequestTimer = visibleCountdown(REVIEW_REQUEST_DURATION_MS, () => {
      reviewRequestTimer = null;
      if (reviewRequestNode === ask) removeReviewRequest({ fade: true });
    });
  }

  // Answered or timed out, the ask fades out where it is; a replacement or a
  // page reset removes it at once.
  function removeReviewRequest({ fade = false } = {}) {
    reviewRequestTimer?.stop();
    reviewRequestTimer = null;
    const ask = reviewRequestNode;
    reviewRequestNode = null;
    if (!ask) return;
    untrackNoticeSize(ask);
    if (!fade || !ask.isConnected) {
      ask.remove();
      return;
    }
    ask.dataset.ccpLeaving = "";
    ask.setAttribute("aria-hidden", "true");
    const finish = () => ask.remove();
    ask.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, REVIEW_REQUEST_LEAVE_MS);
  }

  function clearTransientUi() {
    removeSelectionPopup();
    removeToast();
  }

  function getActiveElementForRestore() {
    const active = document.activeElement;
    return active && active !== document.body && typeof active.focus === "function"
      ? active
      : null;
  }

  function restoreFocusTo(element) {
    if (!element?.isConnected || typeof element.focus !== "function") return;
    try {
      element.focus({ preventScroll: true });
    } catch (_error) {
      element.focus();
    }
  }

  function formatActionFailure(error, summary) {
    const detail = typeof error?.message === "string" ? error.message.trim() : "";
    return detail ? `${summary}. ${detail}` : `${summary}. ${t("page.failure.tryAgain")}`;
  }

  global.CurrencyPageUi = Object.freeze({
    configure,
    installSelectionListeners,
    showPageConvertPrompt,
    setPageConvertPromptRate,
    refreshLanguage,
    removePageConvertPrompt,
    showToast,
    showReviewRequest,
    clearTransientUi
  });
})(globalThis);
