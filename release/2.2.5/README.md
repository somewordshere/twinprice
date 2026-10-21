# Release version 2.2.5

Release prepared 2026-10-21.

### Added

- Added Japanese, Korean and Simplified Chinese to the **Language** menu, so the interface now comes in thirteen languages. They translate the popup, the welcome page and everything the extension shows on a web page. With the language left on **Automatic**, a Japanese or Korean browser gets its own language, and a browser set to any kind of Chinese, including Traditional Chinese (zh-TW, zh-HK), gets Simplified Chinese, the only Chinese translation.
- Added the store name, summary and description in Japanese, Korean and Simplified Chinese. The Firefox description now lists all thirteen interface languages.
- twinprice.com is now published in Japanese, Korean and Simplified Chinese. Uninstalling with one of these languages opens the goodbye page in that language.

### Changed

- Korean text on twinprice.com now wraps between words instead of inside them.

### Privacy

- Policy version bumped to 2.2.5; the wording is unchanged.

### Tests

- Unit tests cover the new languages: matching ja-JP, ko-KR and every Chinese tag (zh, zh-Hans, zh-SG, zh-TW, zh-HK, zh-Hant-TW), the single plural form, the native names in the menu, and the goodbye page addresses `/ja/`, `/ko/` and `/zh-CN/`.
- The Chrome and Firefox language-menu tests now expect fourteen entries (Automatic plus thirteen languages). A new Chrome test opens the on-page prompt and the popup in each of the three new languages.

### Validation

Project checks, 116 unit tests, all 47 Chrome browser tests, and all 3 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. The new website pages were checked in a browser, including at phone width. The popup and on-page prompt in the new languages were checked by the automated Chrome tests, not by screenshot; the Firefox runtime test still switches only between Ukrainian and German.

The twelve non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. The Japanese, Korean and Simplified Chinese goodbye pages this version opens must be live first, and the website carries the updated privacy policy version.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
