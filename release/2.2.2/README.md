# Release version 2.2.2

Release prepared 2026-10-02.

### Added

- Added a **Language** menu to Page options and to the welcome page, with ten interface languages: English, German, Spanish, French, Italian, Dutch, Polish, Brazilian Portuguese, Turkish, and Ukrainian. It translates the popup, the welcome page, and everything the extension shows on a web page. **Automatic**, the default, follows the browser's language.
- Added the store name and summary in Italian, Dutch, Turkish, and Ukrainian, so every interface language also has a store listing.
- Currency names now appear in the chosen language.

### Changed

- The language is a new synchronized setting, saved with the other preferences. Messages that originate from the exchange-rate provider, such as a rate being unavailable, are still shown in English.

### Privacy

- The privacy policy now lists the interface language among the stored preferences. It is kept in browser storage like the other preferences and is never sent anywhere.

### Validation

Project checks, 113 unit tests, all 43 Chrome browser tests, and both Firefox runtime tests passed, including one that switches the language menu to Ukrainian and German in real Firefox. Firefox package validation reported no errors, warnings, or notices.

The nine non-English translations were written without review by native speakers.

### Release order

Deploy the website (it carries the updated privacy policy) before uploading these packages.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
