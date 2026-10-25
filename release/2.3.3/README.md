# Release version 2.3.3

Release prepared 2026-10-22.

### Changed

- **Page options** now lists **Convert this site automatically**, **Convert all websites automatically** and **Show the on-page Convert button** right below **Enable converter**, ahead of the language, theme and price-display menus. **Converted price appearance** comes last, so the options that decide when prices convert no longer sit below the appearance editor.

### Privacy

- Policy version bumped to 2.3.3; the wording is unchanged.

### Tests

- No test changes. A Chrome screenshot of the popup confirmed the new order.

### Validation

123 unit tests, all 53 Chrome browser tests, and all 4 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. The project checks did not complete: they stop at an unpacked build folder inside `release/2.3.2/`, which was left in place, so the checks after that one were not run for this version. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.3.2 too, and the test passes.

### Release order

Deploy the website before uploading these packages. It carries the updated What's new page and privacy policy version.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
