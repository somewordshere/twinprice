# Release version 2.2.3

Release prepared 2026-10-02.

### Fixed

- Selecting a price that is already in your target currency no longer does nothing. A short notice now reads "This price is already in PLN", and the right-click action says the same and tells you to change the target currency. Before, the button stayed hidden and the right-click action reported that it could not identify the currency. The notice is translated into all ten interface languages.

### Tests

- Added Firefox tests that select a price with a real mouse drag and cover the Convert selection button, the right-click action, and the same-currency notice, including a price written with the currency code first (PLN 49.90). Added the matching Chrome test.

### Validation

Project checks, 113 unit tests, all 44 Chrome browser tests, and all 3 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. The new Firefox test fails without the fix and passes with it.

The nine non-English translations were written without review by native speakers.

### Release order

Deploy the website (it carries the updated privacy policy version) before uploading these packages.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
