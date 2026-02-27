# Changelog

## [Unreleased](https://github.com/patcon/polislike-human-cartography-prototype-v2/commits/main) (YYYY-MM-DD)

### Added

- Download participant metadata from a loaded `.h5ad` file as a CSV ([#33](https://github.com/patcon/polislike-human-cartography-prototype-v2/issues/33)).
  - A download icon button appears above the projection-selector controls (alongside the "Import .h5ad" button) when `obs/*` columns are present in the loaded file. Moving file-action buttons above the projection row keeps the projection row from becoming too wide on mobile.
  - Clicking the button opens a confirmation dialog that shows the participant and column count before the download begins.
  - The downloaded file (`participants.csv`) contains one row per participant with all `obs/*` metadata columns.
- `FloatingModal` legend when viewing an obs-column annotation in the metrics layer ([#29](https://github.com/patcon/polislike-human-cartography-prototype-v2/issues/29)).
  - Shows the column name as the label and colored category swatches for categorical columns; continuous columns show an empty modal (legend to follow).
  - Prev/next arrows (and ←/→ keyboard shortcuts) cycle through available obs columns, updating the active annotation.
  - X button returns to the groups layer, matching the statement-modal behavior.
  - Extended `FloatingModal` with optional `title` and `legendItems` props for the annotation rendering path; existing statement rendering is unchanged.
  - Categorical annotation layers use a dedicated Tableau 20 palette (20 colors) separate from the 10-color painting palette, giving more range without affecting group colors.
  - Legend is hidden for columns with >65 categories (e.g. timestamps, UUIDs) — only the column title is shown, matching continuous column behavior.
  - Blank category labels are displayed as **N/A**.
- Prev/next navigation buttons on `FloatingModal` for touch-friendly statement cycling in votes layer mode ([#27](https://github.com/patcon/polislike-human-cartography-prototype-v2/issues/27)).
  - Extracted shared `cycleStatement` callback so keyboard arrow keys and buttons use the same logic.
  - `onPrev` / `onNext` are optional injected props — buttons only render when provided, keeping the modal reusable for other contexts.

### Changed

### Fixed
