# Release version 2.1.5

Release prepared 2026-09-15.

- Show provider-supplied currency names during setup when the browser only knows the currency code.
- Request optional site access before activating existing tabs, show permission feedback, and allow retries.
- Contain conversion-control events so clicks and keyboard actions do not reach a shop's delegated controls.
- Refresh converted split prices when the site changes their original amount, preserving the latest price on undo in both display modes.
- Convert existing prices when a site reveals them through visibility attributes or styles.
- Preserve negative amounts and currency-specific three-decimal amounts, and reject malformed calculator input.
- Keep explicit foreign currency markers out of manual-source conversions and selections.
- Check popup content width and scrolling without assuming Chromium's surrounding viewport has the same width.

### Historical archive

This release publishes the preserved 2.1.5 packages. Its tag points to the commit that added those archives; that commit's source declares 2.1.7. Use the attached ZIPs for the exact 2.1.5 build, rather than GitHub's automatically generated source archives.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
