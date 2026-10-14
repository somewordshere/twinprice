# Release version 1.7.2

Release prepared 2026-07-24.

Reconstructed from `release/1.7.2/`. This version shipped but was never written
up; the notes below are read from the archive rather than recalled.

### Changed

- Moved the on-page conversion prompt from the bottom of the viewport to the top, and the selection control from the top to the bottom, so the two no longer competed for the same corner.
- Gave the converted value an entrance animation and the prompt a success pulse when a conversion lands.
- Extended the `prefers-reduced-motion` block to cover both new animations as well as the prompt, so a reduced-motion setting still disables everything that moves.

`content/styles.css` is the only file that differs from 1.7.1 apart from the version string.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
