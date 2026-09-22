# Release version 2.1.7

Release prepared on September 23, 2026. Packages use the 2.1.6 runtime with updated version metadata. The repository README now links to this release, and the screenshots removed during the 2.0 redesign are restored under `screenshots/old/`.

- `twinprice-2.1.7-chrome.zip` — Chrome Web Store package
- `twinprice-2.1.7-firefox.zip` — Firefox Add-ons package (Mozilla signing required for permanent installation)

## Validation

- Project checks and all 97 unit tests passed.
- All 39 Chrome browser tests passed.
- Firefox package validation: 0 errors, 0 warnings, 0 notices.
- Both ZIP manifests declare 2.1.7; packaged runtime files match the source.
- README local links resolve; restored screenshots match their historical Git blobs.
- Firefox runtime test timed out after 120 seconds using the locally cached driver; runtime verification remains incomplete.
