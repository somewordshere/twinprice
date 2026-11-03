# Release version 2.5.2

Release prepared 2026-11-03.

### Changed

- After Twinprice has converted prices on five pages, the page itself now asks once: "Enjoying Twinprice? **Rate it** ×". The question sits above the conversion message, so **Undo** stays where it was. **Rate it** opens the store's review page (the Chrome Web Store in Chrome, Firefox Add-ons in Firefox) and counts as rated. × means Twinprice won't ask again, in the popup either. Left alone, the question closes after 15 seconds and the popup's rating line stays. Until now the request was only a line at the bottom of the popup, which people who convert from the page never saw. People who already passed five pages are asked on their next converted page. Edge is still never asked, because it has no store listing of its own.

### Fixed

- Prices a shop loads a moment after the page appears, which Twinprice converts as they arrive, now count toward the five pages. Pages whose prices arrived late never counted before.

### Privacy

- The privacy policy (version 2.5.2, effective November 3, 2026) now lists one more locally stored flag: whether the rating reminder was already shown on a webpage. It is used only to ask once and is never transmitted. Permissions and network requests did not change.

### Tests

- New unit tests: the page asks once, on the fifth page; people already past five are asked on their next page; two tabs reaching five together ask only once; nothing is asked after an answer or in Edge; Rate it opens the right store and counts as rated.
- New Chrome tests: the question stacks above the conversion result and Rate it opens the Chrome Web Store review page; × on the page also hides the popup line; prices added after the first pass are counted.
- New Firefox test: the fifth converted page shows the question, × removes it, and the popup's rating line stays hidden afterwards.

### Validation

Project checks, 153 unit tests, all 73 Chrome browser tests, and all 6 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. One unit test still logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`, as in 2.5.1; the test passes.

The three new on-page strings reuse the popup's wording in all nineteen languages. The eighteen non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the updated privacy policy and the What's new entry.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
