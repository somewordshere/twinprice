# Release version 2.3.1

Release prepared 2026-10-22.

### Fixed

- Korean prices written with 원 after the amount now convert. Before, only ₩ and KRW were recognized, so a Korean shop such as ceragemmall.co.kr showed no prompt and converted nothing. Amounts in ten-thousands (290만원 is 2,900,000 won) and hundred-millions (3억원) convert at their full value, and the same applies to Japanese 万円 and 億円.
- A price whose currency is followed directly by a Korean or Japanese particle now converts: 6,000원부터 ("from 6,000 won") and 1,000円から ("from 1,000 yen"). Words that begin with 원 after a number, such as 3원칙 ("three principles"), are not taken for prices.

### Privacy

- Policy version bumped to 2.3.1; the wording is unchanged.

### Tests

- Detector unit tests for 원, 만, 억, 万, trailing particles, and the 원칙/원리 and Latin-word near misses.
- New Chrome test against the Ceragem event page's price block, with the won added to the stubbed rate provider.

### Validation

Project checks, 123 unit tests, all 53 Chrome browser tests, and all 4 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. The reported page, ceragemmall.co.kr's event page, was checked live in Chrome with this build: all 8 of its won prices converted. The Firefox runtime tests do not exercise the fix directly. One unit test logs "Twinprice initialization failed" because its stand-in browser has no `runtime.getURL`; this happens on 2.3.0 too, and the test passes.

On a price such as 6,000원부터, the converted amount appears between 원 and 부터, because the price ends at 원.

### Release order

Deploy the website before uploading these packages. It carries the updated What's new page and privacy policy version.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
