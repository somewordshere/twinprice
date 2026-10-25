# Twinprice Privacy Policy

Effective date: October 26, 2026 (version 2.4.0)

Twinprice is a Chrome and Firefox extension that identifies prices on webpages and converts them into a currency selected by the user.

## Information processed by the extension

To provide currency detection and conversion, the extension processes the following information locally in the user's browser:

- Visible webpage text that may contain prices or currency markers
- Structured product and price metadata contained in the webpage
- The webpage's domain and declared language, used as weak currency-detection signals
- Text deliberately highlighted by the user for individual conversion

When the converter is enabled, a lightweight detector runs on ordinary HTTP and
HTTPS webpages as they open. It checks locally for supported prices and shows the
on-page conversion prompt only after a likely price is found. A website that the
user marks for automatic conversion may also have its supported prices converted
when it is visited. If the user turns on **Convert all websites automatically**,
supported prices on every ordinary HTTP and HTTPS webpage are converted as soon as
they are found, without the prompt. Webpage information is processed temporarily on the user's
device. Raw page contents and highlighted text are not collected by the developer,
retained by the extension, or transmitted to the developer or exchange-rate
provider. A detected ISO source-currency code may be included in the rate request
described below.

The **Convert custom amount** disclosure processes the entered amount locally and
does not need to inspect the current webpage. If the source remains `AUTO` and no
page conversion has identified it, the popup requires the user to choose an
explicit source currency. The amount itself is not included in the rate request.

## Settings and locally stored information

The extension stores:

- Whether the extension is enabled
- The selected source-currency mode
- The selected target currency
- Price-display, converted-price appearance, interface-language, page-prompt, and convert-all-websites preferences
- Recently selected currency codes
- A cache of exchange rates, including the rate date and fetch time
- The origins of websites the user chooses for automatic conversion
- A source-currency mode for an automatic-conversion website, including a manual currency or `AUTO`
- A count of webpages where a conversion succeeded, and whether the user opened or
  dismissed the rating reminder, used only to decide when to show that reminder

Core extension settings use the browser's extension sync storage and may be
synchronized by Google or Mozilla according to the user's browser settings and
the browser provider's privacy practices. Recent currencies, remembered website
origins, their source-currency modes, the rating-reminder count, and exchange-rate
data are stored locally in the browser. The rating-reminder count is never
transmitted.

The extension does not store webpage contents, highlighted text, or general
browsing history. It stores only the website origins the user deliberately marks
for automatic conversion and any source-currency mode associated with those
origins, until the user removes that access. Selecting `AUTO` replaces a manual
website source with that website's automatic-detection mode.

## Exchange-rate service

The extension requests reference exchange rates from the public Frankfurter API at:

https://api.frankfurter.dev/

Only ISO currency codes for the source and supported quote currencies are included
in these requests. Webpage contents, highlighted text, price values, URLs, and
browsing history are not sent to Frankfurter.

Requests use HTTPS. As with normal internet requests, Frankfurter and its infrastructure provider may receive technical request information such as the user's IP address and browser network metadata. Their handling of that information is governed by their own practices.

## Website reports

When a conversion fails, the on-page prompt, the conversion notice and the popup
offer **Report this website**. Nothing is sent unless the user presses it. Each
press sends one HTTPS request to https://twinprice.com/api/report containing only:

- The website's hostname, such as `shop.example`, never the page address, its path
  or query, its title or its contents
- Why the conversion failed: no prices found, the source currency not detected,
  or the conversion failed
- The extension version and whether it is the Chrome, Edge or Firefox build
- The selected target currency code and the interface language

The report is filed as a public issue in the extension's GitHub repository
(https://github.com/somewordshere/twinprice/issues), one issue per website, so the
problem can be fixed. Later reports for the same website are added to that issue as
comments. Reports carry no account, identifier or cookie. twinprice.com runs on
Cloudflare, which receives the user's IP address as with any web request; the
report service uses it only to limit how many reports one visitor can send per
minute, does not store or log it and does not pass it to GitHub. GitHub's handling of
public issues is governed by its own practices.

Only websites that exist on the public internet are reported. The extension never
sends names that belong to private networks, such as those ending in `.local`,
`.corp`, `.internal`, `.lan` or `.home.arpa`. Before filing a report,
twinprice.com looks the hostname up in public DNS through Cloudflare's resolver
(cloudflare-dns.com) and refuses it if the name does not exist publicly or points
only to private network addresses, so internal company or home hostnames are not
published.

In Firefox, the browser asks for permission to send this information the first time
the user reports a website. Declining sends nothing. The permission can be withdrawn
in Firefox's add-on settings under **Permissions and data**. To ask for a report to
be removed, open an issue at the address under Contact.

## Data sharing and sale

The developer does not:

- Collect or sell personal information
- Collect browsing history (a website report contains only the one hostname the user
  chose to report)
- Use analytics or advertising trackers
- Use data for personalized advertising
- Share webpage content, highlighted text, or visited URLs with third parties, apart
  from the hostname in a website report the user sends, which is looked up in
  Cloudflare's public DNS and published on GitHub
- Allow humans to read user webpage data. The only user data people can read is the
  hostname in a website report, which the user sends deliberately by pressing
  **Report this website** and which is published as a public GitHub issue

## Permissions

The extension uses the following browser permissions:

- `storage`: saves extension settings and caches exchange rates
- `contextMenus`: provides the “Convert selected currency” right-click action
- Access to ordinary HTTP and HTTPS webpages: loads the local price detector when
  pages open so the extension can find supported prices and offer conversion
  without requiring a toolbar click. Page contents and URLs are not transmitted
- `activeTab` and `scripting`: provides a user-triggered fallback on supported
  pages where the normal detector was not loaded, including manually allowed local files
- Access to `api.frankfurter.dev`: retrieves exchange rates
- Website reports need no extra permission. In Firefox they use the optional
  "browsing activity" data-collection permission, requested on the first report
- Optional HTTP and HTTPS site access: requested by **Activate my open tabs**
  to find existing web tabs and start the local detector without reloading them.
  You can decline and reload those tabs instead. Turning on **Convert all websites
  automatically** asks for the same access if the browser has not granted it, so the
  detector can run on every website; declining leaves that setting off. Tab URLs are
  not transmitted

## Limited Use

Information received through browser extension APIs is used only to provide
Twinprice's disclosed single purpose and is handled in accordance
with the Chrome Web Store User Data Policy, including the Limited Use
requirements. It is not used for advertising, profiling, credit decisions, sale,
or unrelated purposes, and humans are not allowed to read webpage data. The one
exception is the hostname of a website the user chooses to report: pressing
**Report this website** is the user's affirmative agreement for that hostname to be
read by the developer and published, so the problem can be fixed.

## Data retention and deletion

Webpage information and selected text are processed only while the relevant webpage is open and are not retained.

Saved settings and automatic-conversion website origins remain until the user
changes them, clears extension data, or uninstalls the extension. Turning off the
global **Enable converter** switch stops price scanning, prompts, and automatic
conversion without deleting a saved automatic-conversion origin or its
source-currency mode.

Turning off **Convert this site automatically** deletes the remembered origin and
its source-currency mode. Ordinary local price detection and the on-page prompt
remain available while the global converter is enabled. Turning off **Convert all
websites automatically** stores that preference and restores the original prices on
pages it converted, without deleting websites the user marked individually.
Selecting `AUTO` for an
automatic-conversion website stores automatic detection as that website's source
mode.
Cached exchange rates are refreshed regularly and remain available as an offline
fallback until local extension data is cleared or the extension is uninstalled.

## Uninstalling

When the extension is uninstalled, the browser opens the goodbye page on
twinprice.com, a page with optional links for reporting what went wrong. It opens
in the extension's interface language: https://twinprice.com/goodbye/ for English,
or the same page in that language's folder, such as https://twinprice.com/de/goodbye/.
The language is the only thing the address reveals. It contains no identifiers, no
other settings, and no browsing information, and nothing is sent when the page opens.

## Security

All external exchange-rate requests and website reports use HTTPS. The extension does not execute remotely hosted code.

## Children

The extension is not designed to collect personal information from children or any other users.

## Changes to this policy

If the extension's data practices change, this policy will be updated before the changed version is published.

## Contact

For privacy questions, open an issue at
https://github.com/somewordshere/twinprice/issues. Issues are public;
do not include anything you would not want published.
