# Release version 2.4.1

Release prepared 2026-10-28.

### Fixed

- Shops in New Zealand, Australia, Canada, Singapore and Hong Kong that write prices with a plain `$` now convert. Twinprice detected the right currency from the domain and page language (for example priceme.co.nz: `.nz` plus `lang="en-NZ"`, medium confidence), but `$` belonged only to the US dollar and the Mexican peso, so not one price matched and the page reported "No confidently identified prices found". These five dollars now accept a plain `$` when the page names exactly one of them, and a page full of `$` prices confirms that currency the way amazon.com's confirms the US dollar. With nothing else to go on, or with two dollars named, `$` still converts nothing. The popup still shows these currencies as NZ$, A$ and so on.
- Choosing the New Zealand, Australian, Canadian, Singapore or Hong Kong dollar as the source currency by hand now also reads plain `$` prices, but never the `$` inside US$ or A$.

### Tests

- New detector cases for a New Zealand price-comparison page and an Australian shop pricing in plain `$`, a US shop that must stay in US dollars, a `$` page with no other signal and a `.co.nz` page with a US page language that must convert nothing, and a hand-chosen New Zealand dollar that reads `$` but not US$ or A$. The new cases fail on 2.4.0.
- The live priceme.co.nz page (its text captured in a browser on 2026-10-28) was replayed through the 2.4.0 and 2.4.1 detector: 0 of 40 prices converted before, 40 of 40 after. computerdirect.co.nz, the other reported site, was not checked: it showed a Cloudflare bot check.

### Validation

Project checks, 148 unit tests, all 60 Chrome browser tests, and all 5 Firefox runtime tests passed on the final code. Firefox package validation reported no errors, warnings, or notices. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.4.0 too, and the test passes.

Nothing about stored data, permissions or network requests changed. The privacy policy only records the new version; its text and effective date (October 26, 2026) are unchanged.

The twelve non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the What's new entry.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
