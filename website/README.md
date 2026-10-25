# Twinprice website

A buildless, responsive landing page and privacy page for the existing Chrome and Firefox extension. The original extension files and release process are separate.

## Preview

From this directory, run `npm run dev` and open `http://127.0.0.1:4173`.
Run `npm run check` to check JavaScript syntax. No installation is required; the only build step is `npm run i18n`, which regenerates the translated pages after an English page or a translation changes.

## Content

- `dist/index.html`: landing page, store links, screenshot, FAQs.
- `dist/styles.css`: shared responsive styles, keyboard focus, reduced motion.
- `dist/demo.js`: local example conversions; no requests or persistence.
- `dist/privacy/index.html`: the full existing extension policy and website privacy information.
- `dist/guide/index.html`: illustrated installation and conversion guide, with worked shopping examples and troubleshooting.
- `dist/about/index.html`: public product facts, publisher attribution, sources, rate and privacy details, and an invitation for honest reviews. Publisher attribution was checked against both official store listings on 2026-09-14; avoid presenting an invented personal biography or a common store version.
- `dist/sitemap.xml` and `dist/robots.txt`: canonical page discovery for search crawlers. Update `lastmod` only when that page changes substantially; omit verification and asset URLs.
- `dist/assets/social-preview.png`: 1200 × 630 sharing card. Rebuild with `node social-preview.mjs` using the repository's Playwright dependency; deployment uses the committed image without a build step.
- `dist/whats-new/index.html`: every release, newest first, linked from the footer of every page. Generated; do not edit.
- `sync-whats-new.mjs`: run `node sync-whats-new.mjs` from this directory to rebuild the What's new page from the repository's `WHATS-NEW.md`, then run `npm run i18n`. As on the privacy page, the release notes stay in English (`lang="en" translate="no"`); only the page around them is translated.
- `sync-policy.mjs`: run `node sync-policy.mjs` from this directory to refresh the privacy page from the parent extension's `privacy-policy.md`, then run `npm run i18n` so the translated privacy pages and the language menu follow.

## Languages

The site is published in the extension's thirteen interface languages: English at the root and German, Spanish, French, Italian, Japanese, Korean, Dutch, Polish, Brazilian Portuguese, Turkish, Ukrainian and Simplified Chinese under `dist/<language>/`. The English pages in `dist/` remain the authored source. `npm run i18n` (`build-i18n.mjs`) reads them and writes every translated page, the language menu in each header, the `hreflang` links, and the translated entries in `sitemap.xml`. Commit the generated pages; deployment still has no build step.

- `i18n/en.json`: every piece of English text, keyed by a short hash of its wording. Generated; do not edit.
- `i18n/<language>.json`: the translation for each key. Inline markup is written as numbered tags (`<1>…</1>`, `<2/>`) that must match the English entry.
- `i18n/keep.json`: text that is deliberately the same in every language, such as the wordmark and the fictional shop name.

Changing an English sentence changes its key. The build then lists the sentence as missing in every language, lists the old translation as unused, and exits with an error until each language file is updated. Text read by the scripts lives in `data-text-*` attributes so it is translated with the page. Currency names in the demo come from the browser's own `Intl.DisplayNames`. Button and menu names quoted in the guide match the extension's own translations in `src/shared/translations-app.js` and `translations-page.js` (a test in `tests/i18n.test.js` checks this for every language); the right-click menu entry stays in English because the extension does not translate it.

The extension policy text on the privacy page stays in English in every language, marked `lang="en" translate="no"`, because it is synced verbatim from `privacy-policy.md`; the surrounding page and the "This website" section are translated. The store links on translated pages open the matching store language. To add a language, add it to `LANGUAGES` in `build-i18n.mjs` with the date its pages first go live (`since`, used for the sitemap), and create its JSON file. Korean text wraps between words (`:lang(ko)` in `styles.css`).

Example rates are illustrative, not live financial data. The demo loops through PLN, USD, JPY, UAH, GBP, MXN, ZAR, KRW, KZT, INR, DZD, BRL, TRY and THB at 2.8-second intervals with a 420ms upward slide. The badge reserves space for the widest example; only text transforms and opacity animate, avoiding per-frame width layout. Formatted example amounts are cached once. These choices are not the full extension currency catalog. Selecting a currency pauses the loop; Play animation resumes it. Turning conversion off, focusing the currency picker, leaving the demo out of view, or hiding the tab suspends cycling. Reduced-motion preferences disable automatic playback by default and remove slide transitions. Automatic changes do not trigger screen-reader announcements. There is no standalone calculator, analytics, tracking, or account system.

## Launch notes

Firefox's current branding was verified directly through Mozilla's add-on API: “Twinprice - Currency Converter for Every Page,” by Krlo, at `https://addons.mozilla.org/en-US/firefox/addon/twinprice/`. The site's logo and favicon use the official 128px icon from that listing (`dist/assets/twinprice-icon.png`). The outdated Chrome naming-transition notices were removed on September 14, 2026 following the owner’s correction. Recheck names and policies when updating the published extension; do not imply both stores have the same release. The published policy is synced from the current extension policy and includes its version and effective date.

The real shopping screenshot is copied unchanged from the extension repository. It is labeled as historical and its rates are not presented as current. Source and support links target the repository documented by the extension.

## Hosting

The public website is https://twinprice.com/. The Wrangler configuration deploys this directory's authored dist/ assets and `worker.js` to the existing twinprice Worker. The custom domain is managed by Cloudflare. The workers.dev endpoint and preview URLs are disabled.

Use Wrangler 4.x from this directory: run wrangler deploy --dry-run, then wrangler deploy. Worker Access is scoped to previews only so the production custom domain is public; do not modify the shared owner-only Access policy or other applications.

### Website reports

`worker.js` answers `POST /api/report`, which the extension's **Report this website** button calls. `run_worker_first: ["/api/*"]` sends only those paths to the script; every page is still served straight from dist/. The Worker accepts requests only from extension origins, checks every field against a fixed format (hostname, reason, version, browser, currency code, language) and opens one GitHub issue per website, titled `Site report: <hostname>` with the `site-report` label. Later reports for the same site become comments. The `REPORT_LIMITER` binding allows five reports a minute from one visitor; the visitor's IP is used only as that key and is never logged or sent to GitHub. Tests: `tests/site-report-worker.test.js` in the repository root.

One-time setup before the first deploy that includes it:

1. Create the `site-report` label in the repository's issues.
2. Create a fine-grained GitHub token for `somewordshere/twinprice` only, with **Issues: Read and write** and nothing else.
3. From this directory, run `wrangler secret put GITHUB_TOKEN` and paste the token. `GITHUB_REPO` is a plain variable in `wrangler.jsonc`.
4. Deploy the website before the extension version that offers the button reaches the stores.

Without the token the endpoint answers 503 and the extension shows "The report could not be sent".

The website source and assets are tracked in GitHub. Extension source and release archives must remain outside the deployed dist/ directory.

## Search information

Keep the homepage's `msvalidate.01` meta tag for Bing Webmaster Tools ownership verification. It is a public verification value and must remain after verification succeeds.

The homepage includes WebSite and SoftwareApplication JSON-LD describing the visible product, free price, official store links, and source repository. There are no invented ratings or reviews. Without a qualifying real rating or review, this does not fulfill Google's software-app rich-result requirements; it still provides truthful semantic product information. Keep the data consistent with visible content and store listings. Do not hardcode a version shared by both stores. The AboutPage uses the same extension ID as the homepage, and the homepage links back to it. External store links use Chrome’s current Twinprice URL slug with the unchanged extension ID.

All public content is delivered as HTML and remains usable without JavaScript. Canonical URLs and social metadata are set on the homepage, guide, about page, and privacy page. Robots permits crawling and advertises the sitemap; this preserves the existing crawler policy, including its treatment of AI training bots. It does not override Cloudflare rules or guarantee indexing or AI citations. No special AI text file, tracking script, or third-party font is required.

Keep `dist/google72aa11731b778087.html` and its exact-path 200 rewrite in `dist/_redirects` for Google ownership verification. Submit `https://twinprice.com/sitemap.xml` through the verified Google Search Console property and Bing Webmaster Tools. Public pages and crawler files must remain accessible without a login or challenge; verify production after deploying without altering the shared preview Access policy.
