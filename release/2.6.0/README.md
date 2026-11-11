# Release version 2.6.0

Release prepared 2026-11-11.

### Added

- Uzbek in Latin script is Twinprice’s twenty-first interface language. Choose **O‘zbekcha** under **Language** in Page options to use it in the popup, welcome page, conversion prompts, selection controls, and website reports.
- The release includes Uzbek pages for twinprice.com, with the interactive demo and help guides.
- Firefox includes Uzbek messages for the browser’s extension name, shortcut, and context menu. Chrome uses its own supported locale for those browser controls.

The Uzbek translation has yet to be reviewed by a native speaker.

### Validation

All 154 unit tests, 83 Chromium browser tests, and 6 Firefox runtime tests passed. Firefox package validation reported zero errors, warnings, and notices. The project checks passed on a clean copy of the release files, and the website build verified all 331 Uzbek translation entries.

### Release order

Deploy the website before uploading the extension to the browser stores so the Uzbek help links resolve.

### Downloads

- [Chrome ZIP](twinprice-2.6.0-chrome.zip)
- [Firefox ZIP](twinprice-2.6.0-firefox.zip). The package requires Mozilla signing for permanent installation.
