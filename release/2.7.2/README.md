# Release version 2.7.2

Release prepared 2026-11-24.

### Fixed

- With **Price display** set to show converted prices only, prices a shop draws in several pieces (such as a currency sign and an amount) stay where the shop put them and are hidden there, instead of being moved into the Twinprice badge. Shops built with React or Vue could stop updating those prices, or throw an error, when they re-rendered them. **Undo** restores the page exactly, including removing any style Twinprice added.
- If a page shows prices in two currencies and the rates for one of them can't be loaded, the others still convert, and the on-page notice and the popup name the currency that was left unconverted.
- Shops on `.hr` and `.bg` domains, and pages in Croatian or Bulgarian, count as euro evidence. Croatia has used the euro since 2023 and Bulgaria since 2026-01-01.
- "AMD", "TRY" and "MAD" no longer name a page's currency on their own. Like the "TL" and "kr" symbols, they only confirm a currency the page's metadata, domain or language already suggests, so a capitalised "Try it free" button or "AMD Ryzen" no longer reads as Turkish lira or Armenian dram.
- Right after installation, rates fetched minutes earlier are no longer reported as stale cached rates once the provider's currency list arrives.
- The popup no longer stays on "Converting…" when the background cannot answer the rate request, and it no longer draws the previous currency pair's rate chart under a pair whose rate failed.

### Tests

- Unit tests cover young rates saved under another currency list, both refetched and as a fallback; Croatian and Bulgarian euro pages; capitalised TRY and AMD words, including right after a price; TRY codes on a Turkish-language page; and the conversion registry no longer moving page nodes.
- Chromium tests cover split-price nodes staying in place in converted-only mode, a shop removing and replacing them without errors, exact Undo of the inline styles, and a page whose second currency has no rates.
- The popup's rate-request failure and rate-chart race have no automated test.

### Validation

Project checks, all 157 unit tests, all 86 Chromium browser tests, and all 6 Firefox runtime tests passed. Firefox package validation reported zero errors, warnings, and notices. The website syntax and localization checks passed.

The Chrome ZIP's manifest declares the background service worker and the Firefox ZIP's declares Firefox's background scripts and add-on ID. Loaded in Chromium with live network access, the Chrome ZIP showed a live USD to EUR rate from Frankfurter. Compared with 2.7.1, only the manifests and the seven changed source files differ.

No user-facing text was added, so no translations changed.

### Release order

Deploy the website before uploading these packages so the updated release notes and policy version are available. Upload `twinprice-2.7.2-chrome.zip` to the Chrome Web Store and `twinprice-2.7.2-firefox.zip` to Firefox Add-ons.

### Downloads

- [Chrome ZIP](twinprice-2.7.2-chrome.zip)
- [Firefox ZIP](twinprice-2.7.2-firefox.zip). The package requires Mozilla signing for permanent installation.
