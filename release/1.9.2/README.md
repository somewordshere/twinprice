# Release version 1.9.2

Release prepared 2026-08-11.

### Changed

- Refactored the background runtime into small settings, site-preference, and page-action services while preserving the always-on detector, remembered-site behavior, fallback injection, and stale-registration cleanup.
- Centralized persisted-setting defaults and validation in one shared schema, and extracted popup save reconciliation and manifest-resource selection into focused controllers.
- Extracted conversion tracking and bounded mutation-root scheduling from the page converter so dynamic discovery and conversion use the same tested lifecycle rules.

### Fixed

- Kept SPA price discovery and conversion working across URL changes and scheduler restarts, including inside late-added open shadow roots, and promoted oversized mutation queues to a bounded full-page scan.
- Queued explicit full-page conversion behind an in-flight mutation scan instead of dropping it, while ensuring Restore invalidates both active and queued work.
- Applied display mode, color, and shape changes to existing conversion wrappers in place without restarting rate work or replacing converted elements.

### Testing

- Added focused schema, popup-controller, manifest-resource, conversion-registry, and mutation-scheduler unit coverage; verified the real Chrome worker import graph against Firefox's classic-script order.
- Expanded real-browser coverage for SPA-style dynamic content, late shadow roots, queued conversion races, Restore cancellation, and in-place presentation updates.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
