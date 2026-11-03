(function () {
  var ua = navigator.userAgent || '';
  var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  function hasBrand(name) {
    for (var i = 0; i < brands.length; i++) if (brands[i].brand === name) return true;
    return false;
  }
  // Brave and Vivaldi send Chrome's user agent. Brave adds navigator.brave; Vivaldi names
  // itself only in some versions and on some sites, so most Vivaldi visitors count as Chrome.
  var browser = /\bOPR\/|\bOpera\b/.test(ua) ? 'opera'
    : /\bEdg(e|A|iOS)?\//.test(ua) ? 'edge'
    : /\bFirefox\/|\bFxiOS\//.test(ua) ? 'firefox'
    : !/\bChrome\/|\bCriOS\//.test(ua) ? 'other'
    : navigator.brave ? 'brave'
    : /\bVivaldi\//.test(ua) || hasBrand('Vivaldi') ? 'vivaldi'
    : 'chrome';
  // iPadOS asks for desktop pages with a Mac user agent, so touch support tells it apart.
  var device = /\b(iPhone|iPad|iPod)\b/.test(ua) || (/\bMacintosh\b/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios'
    : /\bAndroid\b/.test(ua) ? 'android'
    : 'computer';
  if (browser === 'chrome' && device === 'computer') return;
  // Chrome for Android itself, not another Android browser or app view built on Chrome.
  var androidChrome = device === 'android' && browser === 'chrome'
    && !/\b(SamsungBrowser|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser|DuckDuckGo)\/|; wv\)/.test(ua);

  // Edge, Opera, Brave and Vivaldi all install extensions from the Chrome Web Store.
  // Replace with dedicated store URLs once those listings exist. Buttons and
  // notes carry their own text for each case, so translated pages stay translated.

  function relabel(button, attribute) {
    var text = button.getAttribute(attribute);
    if (text) button.firstChild.nodeValue = text + ' ';
  }

  var groups = document.querySelectorAll('.install-buttons');
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    var chrome = group.querySelector('[data-install="chrome"]');
    var firefox = group.querySelector('[data-install="firefox"]');
    if (!chrome || !firefox) continue;

    // On phones only Firefox for Android can add extensions; iPhone and iPad browsers can't.
    var note = device === 'ios' ? 'ios'
      : device === 'android' && browser !== 'firefox' ? 'android'
      : device === 'computer' && browser === 'other' ? 'other'
      : '';
    if (note) {
      var text = document.createElement('p');
      text.className = 'install-note';
      text.textContent = group.getAttribute('data-text-note-' + note);
      group.parentNode.insertBefore(text, group.nextSibling);
    }
    if (device === 'ios' || (device === 'computer' && browser === 'other')) continue;

    if (androidChrome) {
      // Chrome on a phone keeps its Chrome button first; the Firefox button points to Firefox for Android.
      relabel(firefox, 'data-text-android');
    } else if (browser === 'firefox' || device === 'android') {
      // Firefox button becomes the primary (blue) one.
      var chromeClass = chrome.className;
      chrome.className = firefox.className;
      firefox.className = chromeClass;
      group.insertBefore(firefox, chrome);
      if (device === 'android') {
        group.removeChild(chrome);
        if (browser !== 'firefox') relabel(firefox, 'data-text-android');
      }
    } else {
      relabel(chrome, 'data-text-' + browser);
    }
  }
})();
