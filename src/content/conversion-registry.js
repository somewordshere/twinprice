(function initializeConversionRegistry(global) {
  function create({
    restoreWrapper = restoreConvertedWrapper,
    updateWrapperPresentation = () => {}
  } = {}) {
    const wrappers = new Set();

    function add(wrapper) {
      if (wrapper) wrappers.add(wrapper);
      return wrapper;
    }

    function prune() {
      let hasConnectedWrapper = false;
      for (const wrapper of [...wrappers]) {
        if (wrapper?.isConnected) hasConnectedWrapper = true;
        else wrappers.delete(wrapper);
      }
      return hasConnectedWrapper;
    }

    function hasAny() {
      return prune();
    }

    function restoreAll() {
      for (const wrapper of [...wrappers]) {
        restore(wrapper);
      }
    }

    function restore(wrapper) {
      wrappers.delete(wrapper);
      if (wrapper?.isConnected) restoreWrapper(wrapper);
    }

    function updatePresentation(settings) {
      for (const wrapper of [...wrappers]) {
        if (!wrapper?.isConnected) {
          wrappers.delete(wrapper);
          continue;
        }
        updateWrapperPresentation(wrapper, settings);
      }
    }

    function size() {
      prune();
      return wrappers.size;
    }

    return Object.freeze({
      add,
      prune,
      hasAny,
      restoreAll,
      restore,
      updatePresentation,
      size
    });
  }

  function restoreConvertedWrapper(wrapper) {
    if (wrapper.dataset?.ccpAppended === "true") {
      // A badge appended to a split price holds none of the site's nodes; the
      // converter unhides them (it hid them in place) before this runs.
      wrapper.remove();
      return;
    }
    const originalText = wrapper.querySelector?.(".ccp-original")?.textContent || "";
    const ownerDocument = wrapper.ownerDocument || global.document;
    wrapper.replaceWith(ownerDocument.createTextNode(originalText));
  }

  global.CurrencyConversionRegistry = Object.freeze({ create, restoreConvertedWrapper });
})(globalThis);
