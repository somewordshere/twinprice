# Release version 2.1.6

Release prepared 2026-09-15.

### Added

- Added an App theme setting with system, light, and dark options.
- Synchronized the selected theme with the extension's existing settings and restored it whenever the popup reopens.

### Fixed

- Parse Indian digit grouping, Arabic-Indic digits, Arabic separators, and leading-decimal prices without converting numeric fragments from malformed values.
- Re-evaluate automatic currency detection when dynamic pages add prices without changing the URL.
- Refresh prices already on the page when a newer exchange-rate cache arrives.
- Convert visible prices rendered through `display: contents`.
- Reject selections containing multiple prices instead of silently converting only the first.

### Testing

- Added schema validation and real-browser coverage for system theme behavior, immediate theme changes, persistence across popup sessions, dynamic currency detection, live rate refreshes, visibility edge cases, and selection safety.

### Historical archive

This release publishes the preserved 2.1.6 packages. Its tag points to the commit that added those archives; that commit's source declares 2.1.7. Use the attached ZIPs for the exact 2.1.6 build, rather than GitHub's automatically generated source archives.

### Downloads

Choose the attached Chrome or Firefox ZIP. The Firefox ZIP is unsigned and requires Mozilla signing for permanent installation. Publishing this GitHub release does not update the browser store listings.
