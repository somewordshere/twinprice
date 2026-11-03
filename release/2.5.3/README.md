# Release version 2.5.3

Release prepared 2026-11-03.

### Fixed

- Prices drawn as a bare integer followed by a separate part that holds the cents and the currency now convert at the full amount. doz.pl's homepage tiles write 44,99 zł as "44" and "99 zł" in two elements with no separator between them, and the second part looked like a whole price, so every tile was converted as 99 zł while the product page, where the price is one piece of text, was right. Both parts must be marked by the shop as price parts (major/minor, int/dec, whole/fraction, cents), so a quantity next to a total is not joined to it.

### Tests

- New Chrome test: an integer/fraction split tile and an int/dec split price each get one badge with the full amount, and a quantity beside a total is left apart. It fails against 2.5.2, where the tile converts as 99 zł.

### Validation

Project checks, 153 unit tests, all 74 Chrome browser tests, and all 6 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. The first Firefox run failed one of its 6 tests; its name was not captured, and three reruns passed all 6. One unit test still logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`, as in 2.5.2; the test passes.

Nothing about stored data, permissions or network requests changed. The privacy policy only records the new version; its text and effective date (November 3, 2026) are unchanged. No user-facing strings changed, so no translations were touched.

### Release order

Deploy the website before uploading these packages. It carries the What's new entry.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
