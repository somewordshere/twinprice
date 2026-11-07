(function initializeReviewPrompt(global) {
  const STORAGE_KEY = "reviewPrompt";
  // The page asks when the count of converted pages reaches each of these, once
  // each, until the user rates or dismisses. The popup line shows from the first.
  const ASK_ON_PAGE_AT = Object.freeze([5, 40, 100]);
  const SUCCESSES_BEFORE_ASKING = ASK_ON_PAGE_AT[0];
  const MAX_COUNTED_SUCCESSES = 1000;
  const REVIEW_URLS = Object.freeze({
    chrome: "https://chromewebstore.google.com/detail/mocmiipnkiobjgjkfehpcmlapgjaepfk/reviews",
    firefox: "https://addons.mozilla.org/firefox/addon/twinprice/"
  });

  function createReviewPromptService({
    api,
    pageAccess = global.CurrencyPageAccess
  }) {
    // Two tabs can report a success at the same moment; chaining the writes keeps
    // one from overwriting the other's count.
    let pendingWrite = Promise.resolve();

    function update(change) {
      const next = pendingWrite.then(async () => {
        const state = await read();
        const changed = change(state);
        if (changed) await api.storage.local.set({ [STORAGE_KEY]: changed });
        return { ok: true };
      });
      pendingWrite = next.catch(() => {});
      return next;
    }

    async function read() {
      const stored = (await api.storage.local.get(STORAGE_KEY))?.[STORAGE_KEY];
      return {
        successCount: Number.isInteger(stored?.successCount) && stored.successCount > 0
          ? stored.successCount
          : 0,
        dismissed: stored?.dismissed === true,
        rated: stored?.rated === true,
        // The last milestone the page asked at. Up to 2.5.3 a single flag,
        // askedOnPage, recorded the ask at five; it reads as that milestone.
        askedAt: ASK_ON_PAGE_AT.includes(stored?.askedAt)
          ? stored.askedAt
          : stored?.askedOnPage === true ? ASK_ON_PAGE_AT[0] : 0
      };
    }

    // The highest milestone a count has reached, or 0 before the first.
    function milestoneFor(successCount) {
      return ASK_ON_PAGE_AT.filter((milestone) => successCount >= milestone).pop() || 0;
    }

    // The Chrome package is published only on the Chrome Web Store, so whoever
    // runs it, in Chrome, Edge, Brave, Opera or Vivaldi, installed it from there
    // and can rate it there.
    function reviewUrl() {
      return pageAccess.isFirefoxBuild() ? REVIEW_URLS.firefox : REVIEW_URLS.chrome;
    }

    // The popup line is easy to miss for someone who never opens the popup, so the
    // page that brings the count to 5, 40 or 100 also asks, once per milestone.
    // Someone already past a milestone they were not asked at is asked on their
    // next converted page. Deciding inside the queued write keeps two tabs from
    // both asking.
    async function recordSuccess() {
      let askOnPage = false;
      const result = await update((state) => {
        if (state.dismissed || state.rated) return null;
        const successCount = Math.min(state.successCount + 1, MAX_COUNTED_SUCCESSES);
        const milestone = milestoneFor(successCount);
        askOnPage = milestone > state.askedAt;
        if (!askOnPage && successCount === state.successCount) return null;
        return { ...state, successCount, askedAt: askOnPage ? milestone : state.askedAt };
      });
      return { ...result, askOnPage };
    }

    async function getState() {
      const state = await read();
      return {
        ok: true,
        show: !state.dismissed && !state.rated && state.successCount >= SUCCESSES_BEFORE_ASKING,
        url: reviewUrl()
      };
    }

    function dismiss() {
      return update((state) => ({ ...state, dismissed: true }));
    }

    function markRated() {
      return update((state) => ({ ...state, rated: true }));
    }

    // The ask on a web page opens the store from here, since a link inside the page
    // could be caught by the page's own click handlers.
    async function openStore() {
      await api.tabs.create({ url: reviewUrl() });
      return markRated();
    }

    return Object.freeze({ recordSuccess, getState, dismiss, markRated, openStore });
  }

  global.CurrencyReviewPrompt = Object.freeze({
    ...createReviewPromptService({ api: global.ExtensionAPI }),
    create: createReviewPromptService,
    SUCCESSES_BEFORE_ASKING,
    ASK_ON_PAGE_AT,
    REVIEW_URLS
  });
})(globalThis);
