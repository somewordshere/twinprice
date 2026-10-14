# Release version 2.0.3

Release prepared 2026-08-28.

Two detection fixes, both found by writing the regression tests that 2.0.2
should have shipped with.

### Fixed

- Turkish product pages could not resolve a price written as `TL`. A page scores 15 for naming its language and, in 2.0.2, 10 for a visible price marker — 25, just under the 30 needed for medium confidence. Only a listing grid with several prices cleared the bar, so a product page showing one price fell back to "select the source currency manually". What makes an ambiguous marker safe is the corroboration gate, which already requires an independent signal to have named the currency, not the halved weight that was applied on top of it. A corroborated marker now scores per occurrence like an unambiguous one, and a single price resolves.
- A price whose symbol sits one level deeper than its amount was converted twice, rendering as `$99.00 ≈ 89,10 € ≈ 89,10 €`. Markup such as `<p class="price"><span><b>$</b>99.00</span></p>` was planned once as the paragraph a price selector matched and once as the span a split text node nominated. The guard against overlapping plans skipped an element that wrapped an already-planned one but never an element wrapped by one; it is now symmetric, so a nested chain yields a single badge.

### Testing

- The four faults reported on 2026-08-27 are pinned against the markup of the sites that exposed them, with AZN and TRY seeded so the tests convert real manat and lira rather than a dollar stand-in.
- Replaced three one-off tests with matrices, because every one of those faults sat in a cell no test visited: a price-shape corpus holding one row per way a storefront has been seen to draw a price, plus noise that must stay untouched; a display-mode test asserting both modes against both rendering paths; and a page-detection table asserting the currency and confidence floor a page context must produce, with negative rows for a German recipe's teaspoons and an English "TL;DR". The corpus found the double conversion above on its first run.
- Undo is now held to restoring the page's markup byte for byte in both display modes, which matters more since "converted only" began moving the site's own nodes to hide them.
- Added tap.az, Turbo.az, Trendyol, Hepsiburada, and n11 to the live-site matrix, which covered twenty large Western and Asian markets and no market that writes prices with a word-like marker.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
