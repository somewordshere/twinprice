# Release version 2.0.0

Release prepared 2026-08-17.

A design release. The popup is rebuilt around the live exchange rate, and the
on-page surfaces now share its visual language.

### Added

- The current exchange rate is shown in the popup header the moment it opens, in tabular monospace, with a freshness indicator that distinguishes a live rate from a cached or unavailable one.
- A seven-day rate sparkline, backed by a new rate-history service with its own cache, background refresh, and stale fallback. History failures are contained and never affect the live rate.
- Recent currency pairs are remembered and offered as one-tap chips.
- The on-page convert prompt now states the rate it would apply before the conversion is accepted.
- Source and target currencies carry a symbol disc. Currency symbols are used rather than flag emoji, which Windows does not ship and which do not map cleanly to currencies.

### Changed

- The custom-amount converter is always visible instead of collapsed behind a disclosure, and its result updates as you type.
- Page options is now the single disclosure in the popup; the converter, its amount row, and the primary action are permanently visible.
- Rebuilt the popup's colour and type systems on explicit tokens, replacing the ad-hoc scale and weights that had drifted.
- The page prompt, selection bubble, and toast moved onto the popup's palette so every surface reads as one product. Converted-price colours are unchanged, including any the user has customised.
- New extension icon: a single currency glyph on the brand blue, chosen to stay legible at the 16px toolbar size.

### Fixed

- The sparkline was invisible because `hidden` is reflected by `HTMLElement` but not `SVGElement`, so assigning it left the attribute in place.
- The target-currency list is now narrowed to currencies the rate provider can actually quote from first paint, rather than only after the converter was expanded.

### Testing

- Added rate-history unit coverage and end-to-end coverage for the rate hero and the prompt's rate line.
- Made the end-to-end suite hermetic by stubbing the rate provider inside the extension service worker. The suite previously called the live provider and asserted a fixed rate, so it failed whenever the real rate moved.
- Split screenshot capture into its own Playwright project so the test suite no longer writes image files, and added reproducible icon and store-asset tooling.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
