# Release version 2.4.2

Release prepared 2026-10-29.

### Fixed

- A source currency chosen by hand no longer converts a price that the page shows in another currency right beside it. lfmall.co.kr writes the number and its `원` in separate elements, so with the New Zealand dollar chosen, a Korean price of 1,064,700 won showed as ≈ 2 380 243,32 zł (the NZD rate) instead of about 3 158 zł. Automatic mode was not affected: it reads the page as won.
- A discount written as "37" and "%" in separate parts of the page is no longer converted as a price of 37.
- With a source currency chosen by hand, the on-page notice now names that currency. On lfmall it said "converted from KRW" while every converted price said NZD.
- In automatic mode, on pages detected with high confidence, a price without a currency sign that the shop changes after Twinprice converted the prices around it, for example after picking another size, now converts too.
- Automatic detection no longer reads Twinprice's own converted prices and notices as the shop's. In the mode that shows only converted prices, a Turkish page known only by its language and its "TL" prices was read as euro after converting, and a lira price it loaded next stayed unconverted. The page is now read as lira before and after converting, in both display modes.

### Tests

- New detector cases: a hand-chosen currency must not take a bare amount beside a separate `원`, a split "37" + "%" is not a price, and the lfmall product page is detected as won. The `원` and "%" cases fail on 2.4.1.
- New Chrome browser tests: a bare won price beside its `원` stays unconverted with USD chosen, and a price re-rendered beside a converted one converts again (fails on 2.4.1, where the won price converts); a won price added to a deeply indented block that already holds a converted price stays unconverted; and a Turkish page that adds a lira price after converting still converts it, in both display modes (the converted-only test fails on 2.4.1).
- The live-site list gained the lfmall.co.kr product page, priceme.co.nz and computerdirect.co.nz. A headless run on 2026-10-28 could only check LF Mall, which passed in automatic mode; most other Korean and New Zealand shops blocked the headless browser.
- The built extension was checked on the live lfmall page: in automatic mode the main price shows ≈ 3158,43 zł from won; with the New Zealand dollar chosen, the won price block is left alone, the "37%" badges no longer convert, and a sale price the page re-renders converts again.

### Validation

Project checks, 148 unit tests, all 64 Chrome browser tests, and all 5 Firefox runtime tests passed on the final code. Firefox package validation reported no errors, warnings, or notices. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.4.1 too, and the test passes.

Nothing about stored data, permissions or network requests changed. The privacy policy only records the new version; its text and effective date (October 26, 2026) are unchanged.

This release adds no interface text. The twelve non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the What's new entry.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
