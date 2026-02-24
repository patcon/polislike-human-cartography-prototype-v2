# Changelog

## [Unreleased](https://github.com/patcon/polislike-human-cartography-prototype-v2/commits/main) (YYYY-MM-DD)

### Added

- Prev/next navigation buttons on `FloatingModal` for touch-friendly statement cycling in votes layer mode ([#27](https://github.com/patcon/polislike-human-cartography-prototype-v2/issues/27)).
  - Extracted shared `cycleStatement` callback so keyboard arrow keys and buttons use the same logic.
  - `onPrev` / `onNext` are optional injected props — buttons only render when provided, keeping the modal reusable for other contexts.

### Changed

### Fixed
