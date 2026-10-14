# Twinprice

Manifest V3 currency-conversion extension for Chrome and Firefox, built from one
`src/` tree. Public repo: github.com/somewordshere/twinprice. Website: twinprice.com.

## Commands

```bash
npm run verify                # project checks (scripts/check-project.js) + unit tests
npm run test:browser          # Chrome extension tests (Playwright)
npm run test:browser:firefox  # Firefox runtime tests (geckodriver)
npm run lint:firefox          # web-ext lint of the Firefox package
npm run build                 # dist/<browser>/ + release/<version>/*.zip
npm run release               # verify + lint:firefox + build + check
```

Node 22 (`.nvmrc`). Store-image scripts: `build:store-assets`, `build:firefox-screenshots`,
`build:promo`, `build:video`, `build:icons`.

## Folder map

- `src/` is the extension runtime. `manifests/base.json` plus `chrome.json` or `firefox.json` make the manifest.
- `dist/` holds generated unpacked builds. Never edit or commit it.
- `release/<version>/` holds `README.md` (release notes) and `twinprice-<version>-{chrome,firefox}.zip`, nothing else. Never put unpacked folders here. Once a version is uploaded to a store its folder is frozen. See `release/README.md`.
- `store/` holds everything the store dashboards ask for. Description text lives in `store/listings/<locale>.md` (plain text, for Chrome) and `store/firefox/descriptions/<locale>.md` (AMO Markdown). When you change one, change the other. `store/README.md` has the per-release upload checklist.
- `screenshots/` holds README images. `website/` is twinprice.com, with its own README.
- `local/` is an ignored scratch area: saved shop pages and old notes. Don't commit it.

## Code rules (enforced by check-project.js)

- Call browser APIs through `ExtensionAPI` (`src/shared/browser-api.js`), never `chrome.` or `browser.`.
- `src/background/main.js` stays a small router (150 lines or fewer). Put logic in services.
- Settings defaults live only in the shared schema (`src/shared/settings.js`).
- Chrome's worker import order must match Firefox's `background.scripts`.

## Release checklist

1. Bump the version in `package.json`, `package-lock.json` (both version fields) and `manifests/base.json`.
2. Move `CHANGELOG.md`'s "Unreleased" notes under `## X.Y.Z - YYYY-MM-DD`.
3. README: update `**Current version:**`, the Chrome/Firefox build badges, the manual-install links and the release-table row.
4. Write `release/X.Y.Z/README.md` from the template in `release/README.md`.
5. If stored data, permissions or network use changed: update `privacy-policy.md` (it must say `(version X.Y.Z)`), then from `website/` run `node sync-policy.mjs` and `npm run i18n`. Then update the privacy answers in `store/chrome/listing.md`.
6. Run `npm run release`, then `npm run test:browser` and `npm run test:browser:firefox`. Record the test counts in the release notes.
7. Commit as `Release Twinprice X.Y.Z: <what changed>`.
8. Deploy the website before uploading to the stores, then follow `store/README.md`.

## Conventions

- Commit messages are one imperative sentence that says what changed for the user.
- Write dates as absolute dates (2026-10-14), never "today" or "last week".
- The UI ships in ten languages (`src/_locales`, `src/shared/translations-*.js`, `store/listings`, `store/firefox/descriptions`, `website/i18n`). A change to user-facing text needs all ten. Native speakers have not reviewed the translations, and release notes say so.
- Release notes and changelog entries describe what the user sees first, then tests and validation. Report test results exactly, including failures and anything skipped.
