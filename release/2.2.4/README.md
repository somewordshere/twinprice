# Release version 2.2.4

Release prepared 2026-10-14.

### Changed

- Language, App theme and Price display under Page options now open the same dropdown as the currency fields, in place of the browser's plain menu. The list matches the popup in light and dark themes, marks the current choice, and works with the arrow keys, Home, End, Enter, Escape and typing the first letters of a choice.
- Uninstalling now opens the goodbye page in the extension's language instead of always in English. With the language left on Automatic it follows the browser's language, and it changes as soon as you pick another language in the popup. A language the website has no page for falls back to English.

### Privacy

- The Uninstalling section now says the goodbye page opens in the extension's interface language, so its address shows that language (for example `/de/goodbye/`). It still carries no identifiers, no other settings and no browsing information, and nothing is sent when the page opens.

### Tests

- Chrome browser tests now open the three dropdowns and pick from them with the mouse and the keyboard. Added unit tests for the goodbye page address in each language, for following the browser's language, and for updating when the language setting changes. A new test fails if the add-on offers a language the website has no goodbye page for.

### Validation

Project checks, 116 unit tests, all 44 Chrome browser tests, and all 3 Firefox runtime tests passed. Firefox package validation reported no errors, warnings, or notices. The new dropdowns were checked by screenshot in Chrome in light and dark themes; the Firefox tests change the language through the underlying control and do not click the new dropdown.

The nine non-English translations were written without review by native speakers.

### Release order

Deploy the website before uploading these packages. It carries the updated privacy policy, and the translated goodbye pages this version opens must be live first.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
