# Firefox Add-ons (AMO) listing

Where: https://addons.mozilla.org/developers/ > Twinprice > Edit Product Page.
None of these fields need a new version.

Follows Mozilla's guide, "Create an appealing listing":
https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/

## Describe Add-on

| Field | Set to |
| --- | --- |
| Name | Comes from the package (`extNameFirefox` in `src/_locales/<locale>/messages.json`, 45 characters at most). |
| Summary | Comes from the package (`extDescription`, 132 characters at most; AMO allows 250). Keep it the same as the package so both stores say the same thing. |
| Description | Paste `descriptions/<locale>.md` (all of it). It uses only the Markdown AMO supports. |
| Categories | **Shopping** only. AMO allows two, but Appearance is for themes and page restyling. |
| Tags | `shopping` and `privacy`, if AMO offers them in its tag list. |
| Homepage | `https://twinprice.com/` |
| Support email | None yet. Mozilla asks for at least an email. Add one when there is a project address. |
| Support website | `https://github.com/somewordshere/twinprice/issues` |

### Description Markdown

AMO accepts only this Markdown: `**bold**`, `*italic*`, `[text](url)`, `> quote`,
`-` and `1.` lists, and fenced code. Headings and images are not supported, so
section titles are bold lines. Don't paste `../listings/<locale>.md` into AMO.
Those files are plain text written for Chrome, which has no formatting.

What the Firefox description adds compared with the Chrome text:

- It names Firefox for Android near the top. AMO's Android catalogue is small, and few converters work there.
- It marks the right-click menu and keyboard shortcut as desktop only, because Firefox for Android has neither.
- It explains Firefox's own install prompt: website access plus the `websiteContent` data-collection permission declared in `manifests/firefox.json`.
- It links the rate provider, source code, privacy policy and user guide.

## Screenshots

1280x800, uploaded in this order from `screenshots/` (rebuild with
`npm run build:firefox-screenshots`). Firefox shows the same images in every
language; only the captions can be translated.

| File | Caption |
| --- | --- |
| `01-no-conversion.png` | A shop in another currency, before Twinprice |
| `02-convert-offer.png` | Twinprice offers to convert the page and shows the rate first |
| `03-converted.png` | Every price on the page, with your currency right beside it |
| `04-popup.png` | The popup shows the rate, how fresh it is, and the last seven days |
| `05-highlight-price.png` | Highlight a single price to convert just that one |

Mozilla advises against text on screenshots, because it can't be translated.
These images carry English headlines and a step number, so the captions repeat
what each one shows. A text-free set would suit AMO better the next time the
screenshots are rebuilt.

## Technical details

| Field | Set to |
| --- | --- |
| Privacy policy | Paste `privacy-policy.md` from the repository root. Mozilla asks for the text in the listing, not only a link. Update it whenever the policy version changes. |
| License | MIT |

## Version details (per upload)

Keep the release notes short and lead with what users will notice. Use the
"Changed" and "Fixed" bullets from `release/<version>/README.md`, without the
test and validation sections. For 2.2.4:

```text
- Language, App theme and Price display now open the same dropdown as the currency fields, in light and dark themes, and work with the keyboard.
- The goodbye page after uninstalling now opens in the extension's language.
```

## Translations

The name and summary switch language by themselves (they come from
`src/_locales`). For each language, switch the language at the top of the Edit
Product Page, then paste `descriptions/<locale>.md` and the translated
screenshot captions. Only English has an AMO-formatted description so far.
Until the others exist, paste `../listings/<locale>.md`. It is plain text, so
it displays correctly, just without bold or links.
