# Release version 2.3.2

Release prepared 2026-10-22.

### Changed

- The on-page Convert prompt and the notice shown after converting ("Converted N prices") are 10% smaller. Width, spacing, corners, text, buttons and close buttons all scale down together. The prompt is now 270 pixels wide instead of 300, and the notice at most 324 instead of 360. The selection button and converted prices are unchanged.

### Privacy

- Policy version bumped to 2.3.2; the wording is unchanged.

### Tests

- No test changes. Before and after screenshots in Chrome confirmed both panels at 90% of their previous width and height.

### Validation

Project checks, 123 unit tests, all 53 Chrome browser tests, and all 4 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. In Chrome the prompt measured 270 × 134 pixels (before: 300 × 149) and the notice 324 × 53 (before: 360 × 58). Sizes were not measured in Firefox. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.3.1 too, and the test passes.

### Release order

Deploy the website before uploading these packages. It carries the updated What's new page and privacy policy version.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
