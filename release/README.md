# Release packages

Each published version has its own folder. Nothing else goes in `release/`.

```text
release/<version>/
  README.md                       release notes, also used as the GitHub release text
  twinprice-<version>-chrome.zip  Chrome Web Store upload (also used for Edge)
  twinprice-<version>-firefox.zip Firefox Add-ons upload
```

- `npm run build` writes both ZIPs here from `package.json`'s version. Unpacked builds go to `dist/`, never into a release folder (`release/*/*/` is ignored).
- Treat a folder as frozen once its version has been uploaded to a store. A fix ships as a new version.
- `npm run check` fails if a release folder has no `README.md`, or if a version from 2.1.0 on is missing either ZIP.
- Older folders keep their original file names: `currency-converter-pro-<version>-<browser>.zip` (1.6.0–2.0.3) and `currency-converter-<version>-chrome-store.zip` (1.4.0–1.5.1, Chrome only).

## Release notes template

Copy this into `release/<version>/README.md` and delete the sections you don't need. Write for users first, using the same wording as the `CHANGELOG.md` entry.

```markdown
# Release version X.Y.Z

Release prepared YYYY-MM-DD.

### Added

- 

### Changed

- 

### Fixed

- 

### Privacy

- Only if privacy-policy.md changed.

### Tests

- 

### Validation

Project checks, N unit tests, all N Chrome browser tests, and all N Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices.

The nine non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
```
