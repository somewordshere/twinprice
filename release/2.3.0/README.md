# Release version 2.3.0

Release prepared 2026-10-21.

### Added

- **Convert all websites automatically** under **Page options** in the popup. When it is on, every website converts its prices as soon as they are detected, without the on-page prompt and without the "Converted N prices" notice. Prices that a page adds later, and pages reached by in-page navigation, convert the same way. It is off by default.
- Turning it on asks for access to all websites when the browser has not granted it, and stays off if that is declined. Turning it off restores the original prices on pages it converted and brings back the prompt there. Websites chosen with **Convert this site automatically** keep converting.
- If an automatic conversion fails, the prompt appears instead (when it is turned on), so the page can still be converted by hand.
- The new label, help text and status messages are translated into all thirteen languages.

### Privacy

- Policy version 2.3.0 describes the new setting: it is stored with the other preferences, it converts prices on every ordinary website without the prompt, and turning it on can request the same optional site access as **Activate my open tabs**. Nothing new leaves the device.

### Tests

- Unit tests for sanitizing and validating the new setting.
- New Chrome tests: with the setting on, a shop converts on load and a price added later converts, with no prompt and no notice; the popup switch stays off when site access is declined, then turns on, converts the open page silently, and when turned off restores the page and shows the prompt again.
- New Firefox runtime test: with the setting on, a real page converts on load with no prompt and no notice.
- The rate service now measures a cached rate's age once per reply. A unit test failed once during this release because the age in the warning and the returned age were read 1 millisecond apart.

### Validation

Project checks, 123 unit tests, all 52 Chrome browser tests, and all 4 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. In the Chrome tests the browser's site-access prompt is stubbed, because headless Chromium cannot answer it; the real prompt was not checked by hand. The popup's footer line ("automatic conversion on") for the new setting is not covered, because the test popup cannot read the shop's address. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.2.6 too, and the test passes.

The twelve non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the updated privacy policy and What's new page.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
