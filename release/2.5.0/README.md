# Release version 2.5.0

Release prepared 2026-11-02.

### Added

- Six interface languages: Czech, Indonesian, Malay, Thai, Vietnamese and Traditional Chinese. The **Language** menu now offers nineteen. They translate the popup, the welcome page and everything Twinprice shows on web pages, and the store name, summary and keyboard-shortcut name. The Chrome store descriptions are translated too; the Firefox description stays in English, as for every other language.
- Browsers set to Chinese for Taiwan, Hong Kong or Macau, or to Traditional Chinese, now get Traditional Chinese automatically. They used to get Simplified Chinese, the only Chinese translation until now.
- twinprice.com gains the same six languages. The demo lamp on its front page is priced in the currency of the page's language (382,70 zł on the Polish page, ¥712.00 on the Simplified Chinese one, €89.00 in English and the euro-area languages), and its own currency is left out of the demo's currency menu and animation.

### Tests

- The unit tests now require nineteen languages, all four Czech plural forms, and Chinese browser languages to resolve by script and region; the existing checks that every language translates every string with the same placeholders, and that the website guide quotes the extension's own button names, cover the six new languages.
- The Chrome language tests expect twenty entries in the language menu (Automatic plus nineteen) and check the popup and on-page prompt in each new language. The Firefox test expects twenty entries too.
- The real toolbar popup was opened in all nineteen languages: no label is cut off, it keeps its width, and the closed popup needs no scrolling. Every website page in every language was checked at phone width (360 px) for sideways overflow; none was found.

### Validation

Project checks, 148 unit tests, all 70 Chrome browser tests, and all 5 Firefox runtime tests passed on the final code. Firefox package validation reported no errors, warnings, or notices. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.4.2 too, and the test passes. Store screenshots remain English-only.

Nothing about stored data, permissions or network requests changed. The privacy policy only records the new version; its text and effective date (October 26, 2026) are unchanged.

The eighteen non-English translations, including the six new ones, were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the What's new entry and the six new languages' pages, which the extension's help and goodbye links open.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
