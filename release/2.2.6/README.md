# Release version 2.2.6

Release prepared 2026-10-21.

### Fixed

- How old a cached exchange rate is ("3 hours old") now appears in the chosen language. Before, it stayed in English in all twelve other languages, in the popup's rate line, the on-page prompt, notices and the tooltip on converted prices. The warnings about cached rates are translated too.
- Messages from the extension's background now appear in the chosen language in the popup and on the welcome page: why a page cannot use automatic conversion (for example a browser page, a local file or the rate provider's own site), conflicts between a target currency and a saved source currency, settings that could not be saved, and the welcome page's request to allow site access.
- On phones, the welcome page no longer scrolls sideways in Spanish, French and Brazilian Portuguese, and its step numbers stay round instead of stretching into wide ovals.
- Korean text in the popup, the welcome page and the on-page prompt now wraps between words instead of breaking inside them. The on-page prompt, selection button and notices now declare the interface language, so screen readers and line breaking follow it rather than the shop's language.
- The popup's twinprice.com links and the welcome page's help link now open the website in the chosen language.
- Exchange rates and other numbers in the popup and on the page use the chosen language's decimal mark (1 USD = 0,9000 EUR in German). The quick converter and the converted-price tooltip now show the rate with four decimals, like the rest of the popup.
- The keyboard shortcut's name on the browser's shortcuts page is translated.
- The guide on twinprice.com now points to the popup's Amount field instead of a "Convert custom amount" control that is not visible, in all thirteen languages.

### Privacy

- Policy version bumped to 2.2.6; the wording is unchanged.

### Tests

- Unit tests for the age wording in every language, translating background replies with an English fallback, locale-aware rate formatting, website links per language, and the translated shortcut name. A scan fails if the background sends a key without English text, and another test checks that the website guide quotes the extension's own button and field names in every language.
- New Chrome tests for a cached rate in German, for the popup's links and site message plus the on-page prompt in Korean, and for the welcome page at 360 pixels wide in eight languages.

### Validation

Project checks, 123 unit tests, all 50 Chrome browser tests, and all 3 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. A Chrome check of all thirteen languages found no English left in the popup, the welcome page or the on-page prompt, and no sideways scrolling on the welcome page at 390 pixels; the Korean welcome page was also checked by screenshot. The Firefox runtime tests do not exercise the new fixes directly. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.2.5 too, and the test passes.

The twelve non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the corrected guide and the updated privacy policy version, and the extension now links to the translated pages.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
