# What's new in Twinprice

Changes you can see, newest first. The technical history for developers is in
[CHANGELOG.md](CHANGELOG.md). There was no 2.2.1. Before 2.1.0, Twinprice was
called Currency Converter Pro.

## 2.4.1 · October 28, 2026

- Shops in New Zealand, Australia, Canada, Singapore and Hong Kong that show prices with just a $ sign, such as priceme.co.nz, now convert. Twinprice found the right currency on these pages but converted none of the prices.
- If you choose the New Zealand, Australian, Canadian, Singapore or Hong Kong dollar as the source currency yourself, prices with just a $ sign now convert too.

## 2.4.0 · October 26, 2026

- New: when Twinprice can't convert a page, the message now offers **Report this website**. One press sends only the website's name, such as shop.example, to twinprice.com so the problem can be fixed. Nothing else from the page is sent, and nothing is sent unless you press it. The popup offers the same button when it finds no prices. Websites that only exist inside a company or home network are never reported.
- In Firefox, your first report asks for your permission once.
- amazon.com prices in US dollars convert again. So do Amazon prices shown with a currency code, such as PLN 34.98, including prices per unit and crossed-out list prices.
- Middle-clicking **Rate it** in the rating reminder now counts, so the reminder no longer comes back.

## 2.3.3 · October 22, 2026

- In **Page options**, the switches for converting automatically and for the on-page Convert button now come right after **Enable converter**, so you no longer have to scroll past the color settings to find them.

## 2.3.2 · October 22, 2026

- The Convert button that appears on a page, and the message after converting, are now about 10% smaller, so they cover less of the page.

## 2.3.1 · October 22, 2026

- Korean prices written with 원, such as 58,000원, now convert. So do amounts in ten-thousands, such as 290만원 (2,900,000 won), and prices followed by a word, such as 6,000원부터 ("from 6,000 won").
- Japanese prices such as 1万円 (10,000 yen) and 1,000円から ("from 1,000 yen") now convert too.

## 2.3.0 · October 21, 2026

- New: **Convert all websites automatically** under **Page options**. Turn it on and prices convert on every website as soon as they appear, without the Convert button or a message. It is off unless you turn it on.
- Turning it off puts the original prices back on pages it converted. Sites you chose with **Convert this site automatically** keep converting.

## 2.2.6 · October 21, 2026

- How old a saved exchange rate is ("3 hours old") now appears in your language instead of in English, and so do the warnings about saved rates.
- More messages appear in your language, such as why automatic conversion is not available on a page.
- Exchange rates use your language's decimal mark, for example 0,9000 in German.
- Links to twinprice.com open the website in your language.
- On phones, the welcome page no longer scrolls sideways in Spanish, French and Brazilian Portuguese, and its step numbers stay round.
- Korean text no longer breaks in the middle of words.
- The keyboard shortcut's name is translated on your browser's shortcuts page.

## 2.2.5 · October 21, 2026

- Twinprice now speaks Japanese, Korean and Simplified Chinese. Choose one under **Language**, or leave it on **Automatic** to follow your browser. A browser set to Traditional Chinese gets Simplified Chinese.
- The store listings and twinprice.com are now available in these three languages too.

## 2.2.4 · October 14, 2026

- **Language**, **App theme** and **Price display** now open the same dropdown as the currency fields, in light and dark themes. You can choose with the mouse or the keyboard.
- The goodbye page shown after uninstalling now opens in the extension's language instead of always in English.

## 2.2.3 · October 4, 2026

- Selecting a price that is already in your target currency now shows a short notice ("This price is already in PLN") instead of doing nothing. The right-click action says the same.

## 2.2.2 · October 2, 2026

- New **Language** menu with ten languages: English, German, Spanish, French, Italian, Dutch, Polish, Brazilian Portuguese, Turkish and Ukrainian. **Automatic** follows your browser.
- Currency names appear in the language you choose.
- The language setting is stored in your browser and never sent anywhere.

## 2.2.0 · September 28, 2026

- The store listing is now available in Polish, German, Spanish, Brazilian Portuguese and French.
- A small rating reminder appears in the popup only after Twinprice has worked on five different pages. It goes away for good once you use it or dismiss it.
- Uninstalling opens a goodbye page where you can say what went wrong if you want to. Nothing that identifies you is sent.

## 2.1.7 · September 23, 2026

- A maintenance release, with no visible changes.

## 2.1.6 · September 15, 2026

- New **App theme** setting: system, light or dark.
- More price formats are recognized, including Indian digit grouping, Arabic-Indic digits and prices written like .99.
- Pages that add prices later are checked again for their currency.
- Prices already converted on the page update when a newer exchange rate arrives.
- Selecting text that contains several prices no longer quietly converts only the first one.

## 2.1.5 · September 15, 2026

- Setup shows full currency names even when your browser only knows the currency code.
- Activating already-open tabs now asks for access first, says what happened, and lets you try again.
- Clicking Twinprice's own buttons no longer triggers buttons on the shop's page.
- Converted prices update when the shop changes the price, and Undo restores the latest price.
- Prices that a shop reveals later now convert.
- Negative amounts and currencies with three decimals are shown correctly.

## 2.1.4 · September 10, 2026

- The popup title links to the website, and the footer no longer overlaps.

## 2.1.3 · September 10, 2026

- The website moved to https://twinprice.com/, and the popup and welcome page link to it.

## 2.1.2 · September 10, 2026

- The popup links to the Twinprice website, and setup help now opens there.

## 2.1.1 · September 5, 2026

- The welcome page has a support link for reporting problems.
- The privacy policy names a support contact you can actually reach: the public issue tracker.

## 2.1.0 · September 4, 2026

- Currency Converter Pro is now called **Twinprice**. Nothing else changed, and installed copies update by themselves.

## 2.0.3 · August 28, 2026

- Turkish product pages showing a single price in TL now convert.
- Fixed a price sometimes being converted twice.

## 2.0.2 · August 28, 2026

- The offer to convert prices comes back when you move to another page inside the same shop.
- More shops' prices convert, including tap.az.
- Turkish prices written as TL are recognized, without misreading recipes that use TL for teaspoons.
- **Converted only** now really hides the original price everywhere, and Undo brings it back.

## 2.0.1 · August 18, 2026

- Fixed swapping the two currencies, which could be refused with an error.
- Finding prices on a page is about 1.7 times faster.

## 2.0.0 · August 17, 2026

- A new popup built around the live exchange rate. It shows how fresh the rate is and a chart of the last seven days.
- Recent currency pairs are one tap away, and the amount converter updates as you type.
- The offer on the page shows the rate before you accept.
- New icon, and one look across the popup and everything shown on pages.

## 1.9.2 · August 11, 2026

- More reliable conversion on shops that change their content without reloading.
- Display, color and shape changes apply instantly to prices already converted.

## 1.9.1 · August 5, 2026

- Fixed the popup becoming too narrow in Chrome and Firefox.
- **Page options** scroll inside the popup when expanded.

## 1.9.0 · August 2, 2026

- Choose the text color, background and shape of converted prices, with a live preview, readability guidance and a reset button.

## 1.8.0 · July 27, 2026

- Twinprice now notices prices by itself as pages open, and offers to convert only when it finds one, including prices that appear later.
- Exchange rates load in the background as soon as a currency is detected, so conversion feels instant.
- Page contents, prices and the sites you visit stay on your device. Only currency codes are sent to look up rates.

## 1.7.3 · July 27, 2026

- Automatic conversion asks for access to one site at a time.
- Each remembered site keeps its own source currency.
- A simpler popup built around the current site, your currency pair and one main button.
- The offer and selection controls can be closed with the keyboard, and Undo stays available.

## 1.7.2 · July 24, 2026

- The offer to convert moved to the top of the page and the selection button to the bottom.
- Converted prices fade in. Animations stop if your system asks for reduced motion.

## 1.7.1 · July 24, 2026

- Removed a separate switch that could silently hide the on-page offer. The offer now follows the main on/off switch.

## 1.7.0 · July 24, 2026

- The converter works on ordinary websites without approving each site first.
- Remembered sites now convert automatically when you return.

## 1.6.2 · July 21, 2026

- Allegro prices split across the page now convert as one price.
- Model names such as R134 and prices inside product titles are no longer converted by mistake.

## 1.6.1 · July 21, 2026

- Swiss shops such as Digitec now convert.
- Fixed one-off conversion in Firefox.
- Clearer messages on pages Twinprice can't work on, such as browser pages and PDF viewers.

## 1.6.0 · July 14, 2026

- Now available for **Firefox**.

## 1.5.1 · July 14, 2026

- Searchable currency pickers that work with the keyboard.
- A cleaner look in light and dark themes, with gentle animations that respect reduced-motion settings.

## 1.5.0 · July 10, 2026

- Remember sites to convert them automatically, with permission you can take back at any time.
- Works on pages that load prices later, change without reloading, or use embedded components.
- Convert any amount right in the popup.
- Convert into every currency the rate provider offers; 50 currencies are detected automatically.
- Recent currencies, a swap button, display options, a keyboard shortcut and a count on the toolbar icon.
- Rates keep working offline for up to seven days, with a warning when they are more than two days old.
- Correct decimals for every currency, such as none for yen and three for dinar.
- Undo puts the page back exactly as it was.
- Faster on large pages.

## 1.4.2 · June 22, 2026

- A maintenance release, with no visible changes.

## 1.4.1 · June 22, 2026

- No longer asks for access to every website. A page is read only after you click the toolbar button, use the right-click menu or press the shortcut.

## 1.4.0 · June 22, 2026

- Fewer false conversions: product names, stock counts, delivery dates, ratings and model numbers are no longer mistaken for prices.
- Split prices such as 3 999 UAH convert as one price.
- New icon.
