# Release version 2.4.0

Release prepared 2026-10-26.

### Added

- **Report this website.** When Twinprice cannot convert a page, the on-page prompt, the conversion notice and the popup offer a one-press report. It sends only the website's hostname (such as `shop.example`, never the page address, path, query or contents), why the conversion failed, the extension version and browser, the target currency and the interface language to twinprice.com, which files one public GitHub issue per website. Nothing is sent without the press. A rate outage or a page already in the target currency offers no report, and one report per page is enough.
- In Firefox, the first report asks for the optional "browsing activity" data permission. A press on a web page or in the popup opens a small Twinprice window to ask, so a popup that Firefox closes for its prompt cannot lose the report. Chrome needs no new permission, and the manifest's host access is unchanged.
- Reports never publish internal hostnames. Names with private endings such as `.local`, `.corp`, `.internal` or `.lan` are never sent, and twinprice.com also refuses any name that public DNS does not know or that points only at private network addresses.
- twinprice.com opens at most 20 new report issues an hour across all visitors, so the repository cannot be flooded. Reports for a website that already has an issue are still added to it.

### Fixed

- amazon.com prices in US dollars convert again. Amazon's pages now name the currency only through the page language, and every price uses the shared `$` symbol, so detection stayed at low confidence. A shared symbol such as `$` now corroborates a currency when exactly one other signal names it.
- amazon.com prices shown with a currency code instead of a symbol ("PLN 34.98", as Amazon shows for a delivery address outside the US) convert again, including per-unit and struck-through list prices.
- Middle-clicking **Rate it** in the popup's rating reminder now counts as rating, so the reminder no longer comes back.

### Privacy

- New "Website reports" section in the privacy policy (version 2.4.0, effective October 26, 2026). It and the Chrome listing's Limited Use answer now say that the hostname in a report the user sends is the one piece of user data people read, with the press as the user's agreement. The README, the Chrome listing's privacy answers and every store listing now name this one exception to "the sites you visit never leave your browser".

### Tests

- New unit tests for the twinprice.com report Worker (including private endings, public DNS, private address ranges, a DNS outage and the hourly cap) and the background report service (including private endings and the popup opening Firefox's consent window).
- New Chrome tests for the report from the on-page prompt, the conversion notice and the popup, including a refused report and a second press that sends nothing. The test harness answers the report endpoint itself, so no test reaches the live service.
- New Firefox runtime test: the notice's **Report this website** opens the consent window for that site and reason, and nothing is sent without consent. Firefox's own consent prompt cannot be driven from WebDriver, so a press on **Send report** after a yes is not covered.
- New Chrome tests for **Rate it** with a left and a middle click, and for amazon.com in US dollars and with currency codes.

### Validation

Project checks, 148 unit tests, all 60 Chrome browser tests, and all 5 Firefox runtime tests passed on the final code. Firefox package validation reported no errors, warnings, or notices. `npm run release` itself stops at its first project check when `release/2.4.0/` already holds these notes but not yet the ZIPs, so its steps (verify, Firefox lint, build, check) were run one at a time with the notes set aside until the build had written the ZIPs. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.3.3 too, and the test passes. On GitHub, the new Firefox consent test failed once on 8ced0b4 with a stale element (the notice was replaced while the test read it); the test was fixed in 0997ab2, and CI passed on that commit.

The report endpoint was deployed and checked on 2026-10-25: one real test report opened issue #5 with the `site-report` label, which was then closed, and requests without an extension origin, with a full page address or with unknown fields were refused. That live version does not yet have the public-name check or the hourly cap in this release; deploy the website first (see Release order).

The twelve non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the What's new entry, the updated privacy policy, and the report Worker's public-name check and hourly cap.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
