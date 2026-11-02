# Release version 2.5.1

Release prepared 2026-11-02.

### Fixed

- The right-click menu entry for converting a highlighted price now appears in the browser's language in all nineteen languages. Before, it was always "Convert selected currency" in English. Like the keyboard shortcut's name, it follows the browser's language, not the **Language** menu. twinprice.com's FAQ and guide quote the translated entry in each language.
- Traditional Chinese now calls the AUTO source option AUTO, as the popup shows it, instead of 「自動」.
- Dutch labels recent currency pairs "Recent gebruikt" instead of the English "Recent".
- The demo switch on the Italian twinprice.com page reads "Attivo"/"Disattivo" instead of "On"/"Off".

### Tests

- A unit test checks that the website's FAQ and guide quote the right-click entry exactly as each language's `src/_locales` names it. The background test checks that the menu takes its name from the locale messages.
- An audit of every language found no other extension string, website string or Chrome store listing copied from English. The remaining English is product and brand names (Twinprice, Firefox, WCAG, PDF, MIT) and words that are the same in the language (for example "Privacy" in Italian and "Guide" in French). The privacy policy and release notes on twinprice.com stay in English on purpose.

### Validation

Project checks, 148 unit tests, all 70 Chrome browser tests, and all 5 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. One unit test still logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`, as in 2.5.0; the test passes.

Nothing about stored data, permissions or network requests changed. The privacy policy only records the new version; its text and effective date (October 26, 2026) are unchanged.

The eighteen non-English translations, including the new right-click entry, were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the What's new entry and the translated right-click wording in the FAQ and guide.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
