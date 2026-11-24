# Release version 2.7.1

Release prepared 2026-11-24.

### Fixed

- Twinprice works again in Chrome and Microsoft Edge. With version 2.7.0 from the Chrome Web Store, Twinprice could not load exchange rates: its window said "The rate service could not be reached" and prices on pages did not convert. The Chrome Web Store had received the Firefox package as 2.7.0, which has no background worker in Chrome. This release contains the same code as 2.7.0. Nothing changes in Firefox.

### Validation

Project checks, all 154 unit tests, all 84 Chromium browser tests, and all 6 Firefox runtime tests passed. Firefox package validation reported zero errors, warnings, and notices. The website syntax and localization checks passed.

The Chrome browser tests answer rate requests with test data, so the Chrome ZIP was also loaded in Chromium with live network access: its manifest declares the background service worker, and the popup showed a live USD to EUR rate from Frankfurter. Apart from the version number, both ZIPs have the same files as the 2.7.0 ZIPs.

### Release order

Deploy the website before uploading these packages so the updated release notes and policy version are available. Upload `twinprice-2.7.1-chrome.zip` to the Chrome Web Store. Uploading the Firefox ZIP to Firefox Add-ons is optional, since Firefox users see no change.

### Downloads

- [Chrome ZIP](twinprice-2.7.1-chrome.zip)
- [Firefox ZIP](twinprice-2.7.1-firefox.zip). The package requires Mozilla signing for permanent installation.
