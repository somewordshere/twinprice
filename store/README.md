# Store listings

Everything the Chrome Web Store and Firefox Add-ons (AMO) dashboards ask for, in
one place. Text and final upload images are committed. Raw captures, the video
file and `growth.md` stay on your machine and are not committed.

```text
listings/<locale>.md   Plain-text descriptions (twenty-one locales), pasted into Chrome
chrome/listing.md      Chrome dashboard fields and privacy-practices answers
chrome/screenshots/en/ 1280x800 screenshots, 01–05, used for every language
chrome/promo/          440x280 small promo tile
firefox/listing.md     AMO fields, screenshot captions, version notes
firefox/descriptions/  AMO descriptions in AMO Markdown (twenty-two locales, Uzbek included)
firefox/screenshots/   The Chrome screenshots with a 1–5 number added
video/                 Demo video notes (the .mp4 is not committed)
archive/               Old Currency Converter Pro listing text, for reference only
source/captures/       Raw Playwright captures the screenshots are built from (not committed)
growth.md              Marketing checklist and weekly numbers (not committed)
```

The store name and short summary are not here. They come from
`src/_locales/<locale>/messages.json` and change with each package upload.
Uzbek is available in the extension’s own language menu. Firefox also ships
Uzbek browser messages, and `firefox/descriptions/uz.md` is its AMO description.
Chrome has no Uzbek locale, so the Chrome package and `listings/` leave it out.
Links from the Uzbek website open the English store pages.

## Regenerating images

```bash
npm run build:store-assets          # captures + an older 4-image layout (see note)
npm run build:firefox-screenshots   # firefox/screenshots from the Chrome set
npm run build:promo                 # chrome/promo tile
npm run build:video                 # video/twinprice-demo.mp4 (needs ffmpeg)
```

The current `chrome/screenshots/en/01–05` set was not produced by
`scripts/build-store-screenshots.mjs`, which still writes the earlier
`01-converted` … `04-select-price` layout. Update that script before relying on
it to rebuild the five current images.

## Per-release checklist

1. Deploy the website first (`wrangler deploy` from `website/`) when the
   privacy policy or any page the extension links to changed.
2. Chrome: upload `release/<version>/twinprice-<version>-chrome.zip`.
   Check the file name before uploading. The Firefox ZIP installs in Chrome
   without an error but has no background worker there, so Twinprice cannot
   load rates (this happened with 2.7.0). The Chrome ZIP's `manifest.json`
   declares `"service_worker"`; the Firefox ZIP's declares `"scripts"` and
   `"gecko"`.
3. Firefox: upload `release/<version>/twinprice-<version>-firefox.zip`.
4. If permissions, stored data or network requests changed: update the
   privacy answers in `chrome/listing.md` and the AMO data-collection answers.
5. If the description changed: edit `listings/en.md` (Chrome, plain text) and
   `firefox/descriptions/en.md` (AMO Markdown), update the other languages,
   then paste each one into its dashboard.
6. If the UI in the screenshots changed: rebuild the images and upload them to
   both stores.
7. Microsoft Edge Add-ons (once listed): upload the same Chrome ZIP.
