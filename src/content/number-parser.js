(function initializeNumberParser(global) {
  const digit = "[0-9０-９٠-٩۰-۹]";
  const thousandsSeparator = "[.,，．'’\\s\\u00a0\\u202f\\u066b\\u066c]";
  const decimalSeparator = "[.,，．\\u066b]";
  const dash = "[\\-–—−]";
  const westernGroupedInteger = `${digit}{1,3}(?:${thousandsSeparator}${digit}{3})+`;
  const indianGroupedInteger = `${digit}{1,2}(?:${thousandsSeparator}${digit}{2})+${thousandsSeparator}${digit}{3}`;
  const integer = `(?:${indianGroupedInteger}|${westernGroupedInteger}|${digit}+)`;
  const capture = `([+\\-−]?(?:${integer}(?:${decimalSeparator}${digit}{1,3}|${decimalSeparator}${dash})?|${decimalSeparator}${digit}{1,3}))`;

  function parseLocaleNumber(value, { allowThreeDecimals = false } = {}) {
    const input = normalizeDigits(value).trim().replace(/−/g, "-")
      .replace(/[，٬]/g, ",").replace(/[．٫]/g, ".");
    // Validate the whole input before removing grouping marks. parseFloat would
    // silently accept a numeric prefix such as "100oops" or "1.2.3".
    const validNumber = /^[+-]?(?:(?:\d{1,2}(?:[.,'’\s\u00a0\u202f]\d{2})+[.,'’\s\u00a0\u202f]\d{3}|\d{1,3}(?:[.,'’\s\u00a0\u202f]\d{3})+|\d+)(?:[.,]\d{1,3}|[.,][\-–—])?|[.,]\d{1,3})$/u;
    if (!validNumber.test(input)) return NaN;
    const compact = input
      .replace(/[’']/g, "")
      .replace(/[\s\u00a0\u202f]/g, "")
      .replace(/[，]/g, ",")
      .replace(/[．]/g, ".")
      .replace(/[.,][\-–—−]$/, "");
    const lastDot = compact.lastIndexOf(".");
    const lastComma = compact.lastIndexOf(",");
    let normalized = compact;

    if (lastDot > -1 && lastComma > -1) {
      normalized = lastDot > lastComma
        ? compact.replace(/,/g, "")
        : compact.replace(/\./g, "").replace(",", ".");
    } else if (lastComma > -1) {
      const decimals = compact.length - lastComma - 1;
      normalized = (decimals <= 2 || (allowThreeDecimals && compact.indexOf(",") === lastComma))
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
    } else {
      const decimals = compact.length - lastDot - 1;
      if (lastDot > -1 && compact.indexOf(".") !== lastDot && decimals !== 3) return NaN;
      normalized = lastDot > -1 && (compact.indexOf(".") !== lastDot || decimals > 2 && !allowThreeDecimals)
        ? compact.replace(/\./g, "")
        : compact;
    }

    return Number(normalized);
  }

  function normalizeDigits(value) {
    return value
      .replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
      .replace(/[٠-٩]/g, (character) => String(character.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (character) => String(character.charCodeAt(0) - 0x06f0));
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildMarkerPattern(marker) {
    const escaped = escapeRegex(marker);
    const latinStart = /^[A-Za-z]/.test(marker) ? "(?<![A-Za-z])" : "";
    const latinEnd = /[A-Za-z.]$/.test(marker) ? "(?![A-Za-z])" : "";
    return `${latinStart}${escaped}${latinEnd}`;
  }

  global.CurrencyNumberParser = Object.freeze({
    NUMBER_CAPTURE: capture,
    parseLocaleNumber,
    normalizeDigits,
    buildMarkerPattern
  });
})(globalThis);
