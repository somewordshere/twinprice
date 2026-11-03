(function () {
  var ua = navigator.userAgent || '';
  var browser = /\bOPR\/|\bOpera\b/.test(ua) ? 'opera'
    : /\bEdg(e|A|iOS)?\//.test(ua) ? 'edge'
    : /\bFirefox\/|\bFxiOS\//.test(ua) ? 'firefox'
    : /\bChrome\/|\bCriOS\//.test(ua) ? 'chrome'
    : 'other';
  // iPadOS asks for desktop pages with a Mac user agent, so touch support tells it apart.
  var device = /\b(iPhone|iPad|iPod)\b/.test(ua) || (/\bMacintosh\b/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios'
    : /\bAndroid\b/.test(ua) ? 'android'
    : 'computer';
  if (browser === 'chrome' && device === 'computer') return;

  // Edge and Opera both install extensions from the Chrome Web Store.
  // Replace with dedicated store URLs once those listings exist. Buttons and
  // notes carry their own text for each case, so translated pages stay translated.

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
    if (device === 'ios' || browser === 'other') continue;

    if (browser === 'firefox' || device === 'android') {
      // Firefox button becomes the primary (blue) one.
      var chromeClass = chrome.className;
      chrome.className = firefox.className;
      firefox.className = chromeClass;
      group.insertBefore(firefox, chrome);
      if (device === 'android') {
        group.removeChild(chrome);
        if (browser !== 'firefox') firefox.firstChild.nodeValue = firefox.getAttribute('data-text-android') + ' ';
      }
    } else {
      chrome.firstChild.nodeValue = chrome.getAttribute('data-text-' + browser) + ' ';
    }
  }
})();
