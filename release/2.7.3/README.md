# Release version 2.7.3

Release prepared 2026-11-25.

### Fixed

- Prices in eBay US search results (`ebay.com`) convert in AUTO mode. Those pages show bare "$" prices, declare only `lang="en"` and carry no product data, so nothing named a currency and Twinprice reported "The source currency could not be detected" (site report: GitHub issue #8). `ebay.com` now counts as a US dollar site, the way Alquiler Argentina counts as a peso site. eBay's country sites, such as `ebay.co.uk`, `ebay.de` and `ebay.ca`, already resolved from their domains. A listing that writes its own currency code, such as "GBP 120.00", still converts as that currency.

### Tests

- Detector unit tests cover eBay US search results, a pound-priced listing on `ebay.com`, the same search page on another `.com` staying unresolved, and `ebay.co.uk` keeping pounds.
- No browser test loads an `ebay.com` address: the Chromium test harness only finds tabs on the test shop's host.

### Validation

Project checks, all 157 unit tests, all 86 Chromium browser tests, and all 6 Firefox runtime tests passed. Firefox package validation reported zero errors, warnings, and notices. The website syntax and localization checks passed.

Before the fix, the live eBay US search page for "iphone 15" was checked in a browser: it declared `lang="en"`, had no price metadata and no "USD" in its visible text, and every price was written with a bare "$". eBay's homepage and item pages already detected US dollars from their page data.

No user-facing text was added, so no translations changed.

### Release order

Deploy the website before uploading these packages so the updated release notes and policy version are available. Upload `twinprice-2.7.3-chrome.zip` to the Chrome Web Store and `twinprice-2.7.3-firefox.zip` to Firefox Add-ons.

### Downloads

- [Chrome ZIP](twinprice-2.7.3-chrome.zip)
- [Firefox ZIP](twinprice-2.7.3-firefox.zip). The package requires Mozilla signing for permanent installation.
