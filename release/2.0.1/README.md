# Release version 2.0.1

Release prepared 2026-08-18.

A maintenance release. It carries the refactor that followed the 2.0.0 design
work, together with one fix for a conversion the popup would not perform.

### Fixed

- Swapping the currency pair failed with "The target ... matches your default source currency" on any site without a saved source override. The guard against a target that duplicates the default source compared the new target against the *previous* source, and the new target of a swap is always the old source, so it rejected every swap. It now compares against the source the same update saves, and still rejects the case where a remembered site's edit genuinely leaves the global source in place.

### Changed

- Price detection is about 1.7x faster. The symbol-group scan lowercased every marker and re-tested the context-required symbol set on each text node, then discarded both; they are now precomputed once per symbol group. Over a 5,000-text-node page mixing price and non-price content, the scan falls from roughly 48 ms to 27 ms, with byte-identical detection output. This is the local page scan only. Rate fetching is network-bound and cached, and is unchanged.
- Deduplicated three parts of the runtime into shared helpers: `background/http.js` for the timeout-and-abort fetch, `background/catalog-snapshot.js` for cached catalog reads, and `shared/content-script-resources.js` for manifest-derived script injection, which the popup and the background page-action service had each derived on their own.
- Reworked the README: added a table of contents, a development quick-start, and the declared Firefox minimums; shortened the release table; and removed the softmax confidence model, which its own text described as uncalibrated.

### Removed

- The `build-release.sh` and `build-release.ps1` wrappers. Both only ran `npm run build`, which is already cross-platform.
- Fourteen unreachable entries from module export objects. Every function and constant they named is still used inside its own module, so only the export line went.

### Packaging

- Added `npm run build:promo`, which renders the 440x280 Chrome Web Store small promo tile through Chromium from the extension's own gradient, glyph, and badge colours.

### Testing

- Added regression coverage for the swap fix: one test asserting that a global pair swap persists, and one pinning the remembered-site conflict that must still be refused.
- Store-asset capture runs against a realistic storefront fixture, the selection screenshot shows the converted amount, and the test catalog ordering is corrected.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
