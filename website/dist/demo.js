const toggle = document.querySelector('#demo-toggle');
const currency = document.querySelector('#demo-currency');
const converted = document.querySelector('#converted-price');
const caption = document.querySelector('#conversion-caption');
const status = document.querySelector('#demo-status');
const playback = document.querySelector('#demo-playback');
const toggleLabel = document.querySelector('#toggle-label');
const rateNote = document.querySelector('#demo-rate');
// The page's own language supplies every sentence; translated pages carry translated attributes.
const language = document.documentElement.lang || 'en';
const currencyNames = language !== 'en' && Intl.DisplayNames ? new Intl.DisplayNames([language], { type: 'currency' }) : null;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
// Fixed demonstration rates, never live quotes, all per euro.
const examples = {
  PLN: { rate: 4.30, locale: 'pl-PL', label: 'Polish złoty' },
  EUR: { rate: 1, locale: 'de-DE', label: 'euros' },
  USD: { rate: 1.10, locale: 'en-US', label: 'US dollars' },
  JPY: { rate: 162, locale: 'ja-JP', label: 'Japanese yen' },
  UAH: { rate: 45.50, locale: 'uk-UA', label: 'Ukrainian hryvnias' },
  GBP: { rate: 0.86, locale: 'en-GB', label: 'British pounds' },
  MXN: { rate: 21, locale: 'es-MX', label: 'Mexican pesos' },
  ZAR: { rate: 20, locale: 'en-ZA', label: 'South African rand' },
  KRW: { rate: 1490, locale: 'ko-KR', label: 'South Korean won' },
  KZT: { rate: 570, locale: 'kk-KZ', label: 'Kazakh tenge' },
  INR: { rate: 92.50, locale: 'en-IN', label: 'Indian rupees' },
  DZD: { rate: 145, locale: 'en-GB', label: 'Algerian dinars' },
  BRL: { rate: 5.60, locale: 'pt-BR', label: 'Brazilian reais' },
  TRY: { rate: 55, locale: 'tr-TR', label: 'Turkish lira' },
  THB: { rate: 37.50, locale: 'th-TH', label: 'Thai baht' },
  CZK: { rate: 25, locale: 'cs-CZ', label: 'Czech korunas' },
  IDR: { rate: 18500, locale: 'id-ID', label: 'Indonesian rupiahs' },
  MYR: { rate: 4.90, locale: 'ms-MY', label: 'Malaysian ringgits' },
  VND: { rate: 29000, locale: 'vi-VN', label: 'Vietnamese dong' },
  CNY: { rate: 8, locale: 'zh-CN', label: 'Chinese yuan' },
  TWD: { rate: 35, locale: 'zh-TW', label: 'New Taiwan dollars' },
};
// The lamp is priced the way a shop in the page's language would price it: in euros
// on English and euro-area pages, in złoty on the Polish one. It is the same €89 lamp
// at the rates above, so every conversion agrees. Its own currency is left out of the
// menu and the animation, where it would only repeat the original price.
const lampCurrencies = {
  cs: 'CZK', id: 'IDR', ja: 'JPY', ko: 'KRW', ms: 'MYR', pl: 'PLN', 'pt-BR': 'BRL',
  th: 'THB', tr: 'TRY', uk: 'UAH', vi: 'VND', 'zh-CN': 'CNY', 'zh-TW': 'TWD',
};
const lampCurrency = lampCurrencies[language] || 'EUR';
const sequence = Object.keys(examples).filter(code => code !== lampCurrency);
// Amounts this large carry no cents on a price tag: Rp 1.646.500, not Rp 1.646.500,00.
const formatPrice = (value, code, locale) => new Intl.NumberFormat(locale, {
  style: 'currency', currency: code, currencyDisplay: 'narrowSymbol',
  ...(value >= 100000 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
}).format(value);
const lampPrice = formatPrice(89 * examples[lampCurrency].rate, lampCurrency, language);
// Format once and reserve enough room for every example without measuring layout.
const amounts = Object.fromEntries(sequence.map(code => [code, formatPrice(89 * examples[code].rate, code, examples[code].locale)]));
const sizing = document.createElement('span');
sizing.className = 'price-sizing';
sizing.setAttribute('aria-hidden', 'true');
for (const amount of Object.values(amounts)) {
  const value = document.createElement('span');
  value.textContent = '≈ ' + amount;
  sizing.append(value);
}
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let playing = !motionPreference.matches;
let visible = true;
let timer;
let transition = [];
let transitionId = 0;

function displayPrice(text, slide) {
  const id = ++transitionId;
  transition.forEach(animation => animation.cancel());
  transition = [];
  const previous = converted.querySelector('.price-value:last-child');
  const next = document.createElement('span');
  next.className = 'price-value';
  next.textContent = text;
  converted.setAttribute('aria-label', text);
  next.setAttribute('aria-hidden', 'true');
  if (!slide || motionPreference.matches || !previous) {
    converted.replaceChildren(sizing, next);
    return;
  }
  previous.setAttribute('aria-hidden', 'true');
  converted.replaceChildren(sizing, previous, next);
  const options = { duration: 420, easing: 'cubic-bezier(.22,.68,0,1)', fill: 'both' };
  transition = [
    previous.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-125%)', opacity: 0 }], options),
    next.animate([{ transform: 'translateY(125%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], options),
  ];
  Promise.all(transition.map(animation => animation.finished)).then(() => {
    if (id !== transitionId) return;
    converted.replaceChildren(sizing, next);
    transition.forEach(animation => animation.cancel());
    transition = [];
  }).catch(() => { /* Manual controls can interrupt a slide. */ });
}

function updateDemo({ announce = false, slide = false } = {}) {
  const example = examples[currency.value];
  const amount = amounts[currency.value];
  displayPrice(`≈ ${amount}`, slide && toggle.checked);
  converted.hidden = !toggle.checked;
  caption.hidden = !toggle.checked;
  toggleLabel.textContent = toggle.checked ? toggleLabel.dataset.textOn : toggleLabel.dataset.textOff;
  rateNote.textContent = fill(rateNote.dataset.textRate, { pair: ratePair(currency.value) });
  // Automatic changes stay quiet for screen readers; announce deliberate actions.
  if (announce) status.textContent = toggle.checked
    ? fill(status.dataset.textOn, { original: lampPrice, amount, currency: currencyNames ? currencyNames.of(currency.value) : example.label })
    : fill(status.dataset.textOff, { original: lampPrice });
}

// "1 PLN = 0.26 USD" reads worse than "1 USD = 3.91 PLN", so the pair is turned
// around whenever that keeps the number at 1 or more.
function ratePair(code) {
  const perLamp = examples[code].rate / examples[lampCurrency].rate;
  const [from, to, value] = perLamp >= 1 ? [lampCurrency, code, perLamp] : [code, lampCurrency, 1 / perLamp];
  const digits = value >= 100 ? 0 : 2;
  return `1 ${from} = ${value.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${to}`;
}

function schedule() {
  clearTimeout(timer);
  playback.textContent = playing ? playback.dataset.textPause : playback.dataset.textPlay;
  playback.setAttribute('aria-pressed', String(playing));
  playback.disabled = !toggle.checked;
  if (!playing || !toggle.checked || !visible || document.hidden || document.activeElement === currency) return;
  timer = setTimeout(() => {
    currency.value = sequence[(sequence.indexOf(currency.value) + 1) % sequence.length];
    updateDemo({ slide: true });
    schedule();
  }, 2800);
}

if (toggle && currency && playback) {
  document.querySelector('.original-price').textContent = lampPrice;
  currency.querySelector(`option[value="${lampCurrency}"]`)?.remove();
  // A lamp priced in another currency starts out converted into euros.
  if (lampCurrency !== 'EUR') currency.value = 'EUR';
  playback.hidden = false;
  toggle.addEventListener('change', () => { updateDemo({ announce: true }); schedule(); });
  currency.addEventListener('change', () => {
    playing = false;
    updateDemo({ announce: true });
    schedule();
  });
  currency.addEventListener('focus', schedule);
  currency.addEventListener('blur', schedule);
  playback.addEventListener('click', () => { playing = !playing; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) playing = false;
    updateDemo();
    schedule();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: 0.15 })
      .observe(document.querySelector('#demo'));
  }
  updateDemo();
  schedule();
}
