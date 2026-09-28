# Release version 2.2.0

Release prepared 2026-09-28.

### Added

- Added the store name and summary in Polish, German, Spanish, Brazilian Portuguese, and French, so each store can list Twinprice in the shopper's language. The extension's own screens remain in English.
- Added a one-line rating reminder to the popup footer. It appears only after conversions have worked on five different pages, never on webpages, and disappears for good once it is used or dismissed.
- Uninstalling now opens a goodbye page on twinprice.com with optional links for reporting what went wrong. The address carries no identifiers.

### Changed

- Reordered and enlarged the store screenshots so the first one shows a fully converted page, with prices readable in the store's small preview, and renamed the promo tile from its old name.

### Privacy

- Documented the local rating-reminder count and the uninstall page. Neither sends any data.

### Validation

Project checks, 103 unit tests, all 40 Chrome browser tests, and the Firefox runtime test passed. Firefox package validation reported no errors, warnings, or notices. The localized name and summary were confirmed in Chrome running in each of the six languages, and uninstalling in Chrome opened https://twinprice.com/goodbye/.

A browser test that injected a fixed 2026-09-18 rate timestamp began failing once that date passed the seven-day cache limit; it now uses the current time.

### Release order

Deploy the website (with `/goodbye/`) before uploading these packages, so the uninstall page exists when the new version reaches users.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
