# Changelog

## [Unreleased](https://github.com/patcon/polislike-human-cartography-prototype-v2/commits/main) (YYYY-MM-DD)

### Added

- `waypointDensity` prop (0–1 slider, default 1.0 = all) for `RoutingExperiment` to sample intermediate waypoints evenly along the path; inactive waypoints remain visible as white dots while active ones stay orange.
- `NavigationMode` story for `RoutingExperiment` with Google Maps-style 3D navigation: right-drag to tilt/orbit (heading + pitch), scroll to zoom, left-drag to pan, double-click to reset view. Adds `navigationMode` prop to the component.
- "Download Votes CSV" button in the download modal to export a vote matrix as `vote-matrix.csv` ([#35](https://github.com/patcon/polislike-human-cartography-prototype-v2/issues/35)). Rows are participants, columns are statement IDs, and values are `1` (agree), `-1` (disagree), `0` (pass), or empty (no vote). The modal now also shows a toggle to prefix filenames with today's date (`YYYY-MM-DD-`), and uses the `conversation_id` from the h5ad file (if present) as a filename prefix.
- "Download Data" button in the projection selector panel to export participant metadata as `participants.csv` ([#33](https://github.com/patcon/polislike-human-cartography-prototype-v2/issues/33)). A confirmation dialog shows participant and column counts before downloading. Includes a `manual_painted` column with the color name of any painted group (e.g. `Orange`, blank if unpainted).
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
