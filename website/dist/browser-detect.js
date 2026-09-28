(function () {
  var ua = navigator.userAgent || '';
  var browser = /\bOPR\/|\bOpera\b/.test(ua) ? 'opera'
    : /\bEdg(e|A|iOS)?\//.test(ua) ? 'edge'
    : /\bFirefox\/|\bFxiOS\//.test(ua) ? 'firefox'
    : /\bChrome\/|\bCriOS\//.test(ua) ? 'chrome'
    : 'other';
  if (browser === 'chrome') return;

  // Edge and Opera both install extensions from the Chrome Web Store.
  // Replace with dedicated store URLs once those listings exist.
  var LABELS = {
    edge: 'Download for Edge',
    opera: 'Download for Opera',
    other: 'Other browsers'
  };

  var groups = document.querySelectorAll('.install-buttons');
  for (var i = 0; i < groups.length; i++) {
    var chrome = groups[i].querySelector('[data-install="chrome"]');
    var firefox = groups[i].querySelector('[data-install="firefox"]');
    if (!chrome || !firefox) continue;

    if (browser === 'firefox') {
      // Firefox button becomes the primary (blue) one.
      var chromeClass = chrome.className;
      chrome.className = firefox.className;
      firefox.className = chromeClass;
      groups[i].insertBefore(firefox, chrome);
    } else {
      chrome.firstChild.nodeValue = LABELS[browser] + ' ';
    }
  }
})();
