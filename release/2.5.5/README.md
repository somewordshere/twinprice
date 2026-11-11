# Release version 2.5.5

Release prepared 2026-11-11.

### Fixed

- Twinprice now recognizes Argentine peso prices on Alquiler Argentina. It reads $90.000 as 90,000 ARS per night and still reads explicit US$ prices as US dollars.

### Tests

- Detector cases cover the reported listings, Argentine language and domain signals, and ambiguous dollar prices on an unrelated hostname.
- A Chromium regression exercises the conversion offer and the converted nightly price on the Mar del Plata listing markup.

### Validation

Project checks, all 154 unit tests, all 82 Chromium browser tests, and all 6 Firefox runtime tests passed. Firefox package validation reported zero errors, warnings, and notices. The website syntax and localization checks passed.

### Release order

Deploy the website before uploading these packages so the updated release notes and policy version are available.

### Downloads

- [Chrome ZIP](twinprice-2.5.5-chrome.zip)
- [Firefox ZIP](twinprice-2.5.5-firefox.zip). The package requires Mozilla signing for permanent installation.
