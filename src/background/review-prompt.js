(function initializeReviewPrompt(global) {
  const STORAGE_KEY = "reviewPrompt";
  const SUCCESSES_BEFORE_ASKING = 5;
  const MAX_COUNTED_SUCCESSES = 1000;
  const REVIEW_URLS = Object.freeze({
    chrome: "https://chromewebstore.google.com/detail/mocmiipnkiobjgjkfehpcmlapgjaepfk/reviews",
    firefox: "https://addons.mozilla.org/firefox/addon/twinprice/"
  });

  function createReviewPromptService({
    api,
    pageAccess = global.CurrencyPageAccess,
    userAgent = global.navigator?.userAgent || ""
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
        rated: stored?.rated === true
      };
    }

    function reviewUrl() {
      if (pageAccess.isFirefoxBuild()) return REVIEW_URLS.firefox;
      // Edge runs the Chrome package, but sending an Edge user to the Chrome Web
      // Store to rate it is wrong; stay quiet there until Edge has its own listing.
      if (/\bEdg\//.test(userAgent)) return null;
      return REVIEW_URLS.chrome;
    }

    function recordSuccess() {
      return update((state) => {
        if (state.dismissed || state.rated || state.successCount >= MAX_COUNTED_SUCCESSES) {
          return null;
        }
        return { ...state, successCount: state.successCount + 1 };
      });
    }

    async function getState() {
      const state = await read();
      const url = reviewUrl();
      return {
        ok: true,
        show: Boolean(url) &&
          !state.dismissed &&
          !state.rated &&
          state.successCount >= SUCCESSES_BEFORE_ASKING,
        url
      };
    }

    function dismiss() {
      return update((state) => ({ ...state, dismissed: true }));
    }

    function markRated() {
      return update((state) => ({ ...state, rated: true }));
    }

    return Object.freeze({ recordSuccess, getState, dismiss, markRated });
  }

  global.CurrencyReviewPrompt = Object.freeze({
    ...createReviewPromptService({ api: global.ExtensionAPI }),
    create: createReviewPromptService,
    SUCCESSES_BEFORE_ASKING,
    REVIEW_URLS
  });
})(globalThis);
