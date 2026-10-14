# Chrome Web Store listing

Where: https://chrome.google.com/webstore/devconsole > Twinprice. The same
package and text are used for Microsoft Edge Add-ons once it is listed there.

## Store listing tab

| Field | Source |
| --- | --- |
| Name and summary | Come from the package (`src/_locales/<locale>/messages.json`: `extName`, `extDescription`). They update with each upload. |
| Description | Paste `../listings/<locale>.md` (everything below the line), one per language in the language menu. |
| Screenshots | Upload `screenshots/en/01–05` in order, for every language. See `../README.md` for how they are made. |
| Small promo tile | `promo/small-promo-tile-440x280.png`, one for all languages. Rebuild with `npm run build:promo`. |
| Video | YouTube URL from `../video/README.md`. |
| Homepage | `https://twinprice.com/` |
| Support | `https://github.com/somewordshere/twinprice/issues` |

## Privacy practices tab

These answers are written to match Twinprice version 2.2.4 and the privacy policy
dated October 4, 2026. If the permissions, stored data, or network requests change,
update this file and the policy together.

### Single purpose

Twinprice detects monetary prices on webpages and converts them into a currency selected by the user.

### Permission justifications

#### `storage`

Stores the user's enabled state, source and target currency preferences, display
mode, converted-price appearance, interface language, and page-prompt preference.
It also stores recent currency codes, the website origins the user chose to convert
automatically (with their source-currency mode), the latest successful exchange-rate
data so the extension can keep working temporarily while offline, and a count of
webpages where a conversion succeeded plus whether the rating reminder was opened or
dismissed, used only to decide when to show that reminder.

#### `contextMenus`

Adds the “Convert selected currency” command to Chrome's right-click menu so users can convert a highlighted price.

#### `activeTab` and `scripting`

Provides a user-triggered fallback on supported pages where the normal detector
was not loaded, including manually allowed local files. Page content is processed
locally and is not transmitted.

#### Ordinary website access: `http://*/*` and `https://*/*`

Loads the lightweight local price detector when ordinary webpages open so the
extension can scan for supported prices and show the conversion prompt without a
toolbar click. The prompt appears only after a likely price is found. Page text,
prices, URLs, and browsing history are not transmitted. A saved origin is used
only to decide whether detected prices should convert automatically on that site.

#### Optional site access: `http://*/*` and `https://*/*`

Requested only when the user presses **Activate my open tabs** on the welcome page.
It lets the extension find tabs that were already open at install time and start the
local detector in them without a reload. The user can decline and reload those tabs
instead. Tab URLs are not transmitted.

#### Host access: `https://api.frankfurter.dev/*`

Required to retrieve reference exchange rates. Requests contain only ISO currency
codes for the source and supported quote currencies. Page content, selected text,
price values, and visited URLs are not sent.

### Remote code

Select:

**No, I am not using remote code.**

The extension downloads exchange-rate data as JSON but does not download or execute JavaScript, WebAssembly, or other executable code. The interface translations are bundled in the package.

### Data usage disclosure

The extension locally accesses website content because that access is necessary
to detect prices and currencies. It does not transmit, sell, or retain website
content or selected text. It locally retains only origins the user deliberately
marks for automatic conversion.

Core extension settings, including the interface language, may be stored through
Chrome Storage Sync. Recent currencies, remembered origins, the rating-reminder
count, and exchange-rate data are cached locally. Only currency codes are sent to
Frankfurter.

The interface language is a display preference. It is not personal information,
location, or any other category the dashboard asks about, and it is never transmitted.

When the dashboard asks which data is **collected**, answer according to the exact wording shown by the current dashboard:

- If “collected” means transmitted off the user's device to the developer or a third party, do not select website content or browsing history. Neither is transmitted.
- If the dashboard explicitly treats local access or local processing as collection, select **Website content** and explain that it is processed locally only for the user-facing conversion feature and is never transmitted or retained.

Do not claim collection of:

- Personally identifiable information
- Health information
- Authentication information
- Personal communications
- Location
- Browsing history sent off-device
- Financial or payment information

Prices shown publicly on shopping webpages are processed as webpage content, not collected as the user's personal financial information.

### Limited Use certification

The extension's use of webpage access is limited to its single user-facing purpose: detecting and converting prices. Data is not used for advertising, profiling, credit decisions, sale, or unrelated purposes. The developer does not allow humans to read user webpage data.

### Privacy policy URL

Use the policy on the website, which is rebuilt from `privacy-policy.md` by
`website/sync-policy.mjs`:

`https://twinprice.com/privacy/`

Deploy the website before submitting, so the page shows version 2.2.4. The same
policy is also published in the repository, if a URL on GitHub is ever needed:

`https://github.com/somewordshere/twinprice/blob/main/privacy-policy.md`

Before submission, verify that the support contact named by the Store listing is
available to users: the public issue tracker at https://github.com/somewordshere/twinprice/issues.
