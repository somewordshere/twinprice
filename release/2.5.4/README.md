# Release version 2.5.4

Release prepared 2026-11-07.

### Added

- Romanian, the twentieth interface language: the popup, the welcome page, the on-page prompt, the selection button and messages, the store name and summary, the keyboard shortcut and the right-click entry. Romanian counts in three forms (1 preț, 3 prețuri, 20 de prețuri), and every counted message has all three. Automatic language follows browsers set to Romanian, including Romanian for Moldova. twinprice.com/ro/ carries the site in Romanian, with the demo lamp priced in lei, and a Romanian Chrome Web Store description is in `store/listings/ro.md`.

### Changed

- The on-page offer to convert prices leaves on its own after six seconds when nobody uses it. The countdown waits while the pointer is over the offer or keyboard focus is inside it, and starts again when they leave. Once **Convert prices** is pressed the prompt stays to show progress, then the result with Undo or an error with Report this website, until it is closed. The Twinprice window and Ctrl+Shift+Y still convert the page.
- On-page countdowns (the offer's six seconds, the rating ask's fifteen, and self-closing notices) run only while their tab is on screen. A shop opened in a background tab still shows the offer when you switch to it, and a rating ask earned by a page converting on its own in a background tab waits until that tab is looked at instead of being spent unseen.
- The conversion result with Undo now leaves after eight seconds on screen instead of covering the shop's header until closed; Restore original prices in the popup still undoes the page. Every self-closing notice waits while the pointer is over it or focus is inside it.
- After a successful conversion the offer's green edge is 2px instead of 1px, without the card changing size.
- The conversion notice (the result with Undo, report offers and short messages) and the rating ask moved from the bottom-right to the top-right corner. They stack down from there 8px apart: the convert offer, then the notice, then the rating ask, which now sits below the result. When one leaves, the ones below glide up into its place.
- The rating ask fades in over half a second with a few pixels of drift, and fades out when answered or after its 15 seconds, instead of appearing and vanishing at once. With reduced motion it only fades.
- The rating ask on the page comes at the 5th, 40th and 100th page where a conversion worked, once each, instead of only at the 5th. Ignoring one leaves the next in place; × or Rate it ends them all. Someone already past a milestone they were not asked at is asked on their next converted page, and an ask at five recorded by an earlier version counts as the first.
- Edge now gets the rating ask on the page and the "Rate it" line in the popup, like every other Chromium browser, both linking to the Chrome Web Store reviews. The Chrome package is published only on the Chrome Web Store, so Edge users installed it from there. Until now both were hidden in Edge for good.
- "Nineteen languages" became "twenty" in the README, the Firefox description and on twinprice.com, in every language.

### Website

- The home page is shorter: the four-part feature tour, the numbered section labels, the real shopping-page screenshot and the Firefox Add-ons rating line were removed. The install buttons name Brave and Vivaldi for visitors using them, and the browser lists say the Chrome Web Store version also works in Edge, Opera, Brave and Vivaldi.

### Privacy

- The privacy policy, now effective November 7, 2026, says the stored rating-reminder data records which reminder (after 5, 40 or 100 converted webpages) was last shown, instead of whether the single reminder was shown. The Chrome privacy-practices answer says the same. Nothing new is stored or sent, and permissions and network requests are unchanged. The policy also names the popup section "Convert a custom amount".

### Tests

- Unit tests expect twenty languages and check Romanian's three plural forms for every counted message, including "de" from 20 on (1, 3, 19, 20, 105 and 120 prices; 2, 5, 20 and 47 hours), and that `ro`, `ro-MD`, `ro_RO` and `mo` resolve to Romanian.
- The language menu tests in Chrome and Firefox expect 21 entries (Automatic plus twenty), a new Chrome test checks the Romanian popup and page prompt, and the goodbye-page test covers `ro-RO`.
- Three new Chrome tests check, in real time, that an untouched offer is gone by eight seconds, that a hovered offer waits and a pressed one keeps its result and Undo with a 2px edge, and that a notice shown beside the offer sits below it and glides up when the offer closes. The rating test now expects the result in the top-right corner with the ask below it.
- A new Chrome test checks that the result with Undo is still there at five seconds and gone by ten with the converted prices left in place, and that a hovered one outlasts nine seconds with Undo still working.
- Two new Chrome tests make the tab look hidden to Twinprice: an offer outlasts eight hidden seconds and leaves within six once shown, and a rating ask earned while hidden appears only when the tab is shown. Both fail without the visibility check. The Firefox rating test now closes the welcome tab that opens on install, which had kept the test page in a background tab.
- The rating unit tests no longer expect Edge to stay silent: the Chrome package links the Chrome Web Store in any browser. New cases check that 150 converted pages ask on exactly the 5th, 40th and 100th, that someone past a milestone is asked once on the next page, and that an older stored ask at five counts as the first milestone.

### Validation

Project checks, 154 unit tests, all 81 Chrome browser tests, and all 6 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. One unit test still logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`, as in 2.5.3; the test passes.
The Romanian translation was written without review by a native speaker, as were the other eighteen non-English translations.

### Release order

Deploy the website before uploading these packages. It carries the Romanian pages and the What's new entry.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
