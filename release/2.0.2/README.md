# Release version 2.0.2

Release prepared 2026-08-28.

A bug-fix release for three faults reported together: the on-page offer went
silent on single-page shops, two whole markets were undetectable, and the
"converted only" display option did nothing on a large class of sites.

### Fixed

- The on-page offer never returned after an in-page navigation. `applySitePreference` ran once, at `document_idle`, and nothing watched for routing afterwards unless the page had already been converted. On a single-page shop the first offer was therefore the only one a visitor ever got: dismiss it, or arrive through a client-side route change, and the extension stayed silent for the life of the tab. A route watcher now re-offers on `popstate`, `hashchange`, the Navigation API, and a one-second poll that backstops `history.pushState`, which fires no event of its own. A bare `#section` anchor is deliberately not treated as a navigation, so anchor clicks do not bring a dismissed offer back.
- Prices a site splits across bare text nodes were never converted. Server-rendered React writes an interpolated amount as `66 000<!-- --> ₼`: no child elements, and two text nodes that carry no price apart. Both split-price paths skipped any element with `childElementCount === 0`, and neither text node matched on its own. Because discovery reads `textContent`, such pages still offered to convert and then reported "No confidently identified prices found" — tap.az converted 0 of 28 visible prices. The guard now also accepts an element whose text is spread over more than one text node.
- Turkish prices were undetectable. `TRY` knew only the `₺` sign, while Turkish storefronts write `249,90 TL`. `TL` is now a recognised lira marker, but a context-required one, so a German recipe's "2 TL Zucker" is not read as two lira.
- "Converted only" left the original price on screen wherever it was split across elements. The appended-badge path never hid what the site had drawn, and the presentation update explicitly skipped the hide branch for those badges, so both display modes rendered identically. The badge now parks the site's own price nodes in a hidden element and hands them back when the setting changes or the conversion is undone. The default side-by-side mode still only appends, and does not touch the site's DOM.

### Changed

- Page-currency detection also weighs the price markers it can see. Storefronts that price in a symbol and never print an ISO code gave detection almost nothing to work with, which is what kept a context-required marker such as `TL` from ever resolving. Unambiguous markers now score on their own; ambiguous ones only corroborate a currency another signal has already named. A substring test precedes each pattern so currencies absent from the page cost no regex pass. This also lifts tap.az from medium to high confidence.

### Testing

- Added regression coverage for all four fixes: end-to-end tests for the re-offer after an in-page route change, for a price split across bare text nodes, and for "converted only" hiding and then restoring an element-split price; detector scenarios for a Turkish storefront, a German recipe that must not read as one, and a manat marketplace; and a registry test that an appended badge returns the price nodes it parked.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
