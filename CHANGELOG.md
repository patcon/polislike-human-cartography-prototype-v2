# Changelog

## [Unreleased](https://github.com/patcon/polislike-human-cartography-prototype-v2/commits/main) (YYYY-MM-DD)

### Changed

- Extracted three custom hooks from `convo-explorer/App.tsx` to reduce its size from ~1230 to ~830 lines: `useRepresentativeStatements` (rep-statements state + async calculation), `useRecomputeDialog` (in-browser reduction dialog + DruidJS state), and `useMetricsLayer` (metrics layer state, loading, and obs-column cycling). Each hook is covered by a new unit test suite using `renderHook`.
- Extracted `useSpotlightMode` hook from `D3Map.tsx` (~345 lines), moving all spotlight touch/pointer/wheel event handling, mutable touch state, and callback-ref sync effects into `src/hooks/useSpotlightMode.ts`. `D3Map` now calls the hook with a single line.
- Extracted `usePipelineManager` hook from `D3Map.tsx` (~160 lines), consolidating pipeline data loading, option derivation, selection initialization, animation state, and auto-cycling into `src/hooks/usePipelineManager.ts`. Returns a clean interface; `D3Map` signals animation completion via `onAnimationComplete()`.
- Extracted `useLassoMode` hook from `D3Map.tsx` (~119 lines), moving lasso drag logic, state refs, and `pointInPolygon` into `src/hooks/useLassoMode.ts`. The hook returns a `lassoCleanupRef` that the zoom effect reads on multi-touch start.

### Added

- `FloatingModalV2` component with `agree` (green), `disagree` (red), `pass` (yellow), and `unstyled` variants — accent color applied to border and statement ID; X button remains optional.
- `FloatingModalV2Stack` for vertically stacking `FloatingModalV2` modals with animated horizontal alignment: agree items slide right, disagree items slide left, pass/unstyled items stay centered.
- `useDruidWorker` hook and its worker script moved into the `reddwarf-ts` package (`reddwarf-ts/react` entry point); the app now re-exports from there.
- Reduction animates live on the map: the recompute dialog closes when Run is clicked, and intermediate point positions are streamed from the worker every 10 iterations and displayed directly on the map. A progress pill at the bottom of the map shows "Building KNN graph…" then a 0–100 % progress bar during iteration. The final result is registered as a named projection as before.
- Annoy KNN backend now exposes its parameters (`numTrees`, `maxPointsPerLeaf`, `seed`) in the recompute dialog, matching the HNSW pattern. Switching backends shows that backend's params immediately; values are forwarded as `knn_params` to PaCMAP and LocalMAP. HNSW params expanded to include `m` and `seed`.
- HNSW `ef` and `ef_construction` inputs in the recompute dialog's Advanced section, shown only when the HNSW KNN backend is selected. Values are forwarded as `knn_params` to PaCMAP and LocalMAP, overriding the library defaults (`ef=50`, `ef_construction=200`).
- In-browser dimensional reduction via DruidJS. After importing an `.h5ad` file, a "Recompute" button in the projection selector opens a dialog to pick a dense `layers/` matrix as the vote matrix, choose an algorithm (UMAP, PaCMAP, or LocalMAP) and its parameters, and run the reduction in a web worker. The result is added as a new selectable projection and auto-selected. Empty cells in the chosen layer are filled with the column mean before reduction (mean imputation). A progress bar shows iteration progress (0–100 %) while the reduction runs, preceded by a "Building KNN graph…" phase indicator.
- `includeAvatars` prop/toggle for `RoutingExperiment` navigation mode to show DiceBear adventurer-neutral avatars (circular crop, radius 90% of pin head) in each pin head, keyed by point ID for stable identity. Toggle appears in the Controls sheet under Waypoint Distribution when navigation mode is active.
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
- Spotlight mode for D3Map: a circle-follows-cursor selection tool where hovering selects all points within the circle radius; on touch, single-finger tracks the ring and two-finger pinch resizes it. Exposed via `mode="spotlight"` and `spotlightRadius` props; explored in the new `SpotlightModeSelection` Storybook story.
- `spotlightPersist` prop for spotlight mode: when enabled, the circle and its selection stay frozen after all fingers lift; the next touch resumes from the last position. Story panel includes a matching checkbox toggle.
- Spotlight touch mechanic reworked as a similarity transform: single touch grabs at the contact point (preserving offset from circle center), two touches apply an incremental scale + rotation + translation each frame so the circle behaves like a sticker layer rather than anchoring to the first finger. No special "primary touch" — both fingers are treated symmetrically.
- `SpotlightRepresentativeStatements` story: D3Map in spotlight mode continuously calculates top representative statements for the selected participants (debounced 400 ms) and displays up to 3 via `FloatingModalV2Stack`.
- Spotlight mode (desktop): clicking the canvas locks the circle in place; clicking again unlocks it. The ring switches from dashed to solid while locked and the cursor changes to a crosshair.
- `FloatingModalV2` renders `cursor-pointer` when an `onClick` prop is provided; `StackItem` type in `FloatingModalV2Stack` now includes an optional `onClick`. `SpotlightRepresentativeStatements` story: clicking a statement card overlays per-participant vote colors on the map; clicking again clears the overlay.
- `SpotlightRepresentativeStatements` story now uses `VOTE_COLORS_HIGHLIGHT_PASS` palette so pass votes render as yellow instead of near-invisible light gray.
- `SpotlightMode` story under `Components/App`: a full App instance with the spotlight tool enabled. Add `enableSpotlight` prop to `App` (default `false`) to activate the `<Spotlight />` toolbar button and wire up spotlight selection → rep-statement calculation → `FloatingModalV2Stack` display. The button is visible but disabled in the production app.

### Changed

- Removed `RepresentativeStatementsManager` class from `reddwarf-ts` and its app-layer wrapper; the class was never instantiated (App.tsx owns `isCalculatingRepStatements` state directly via `useState`).
- Split `reddwarf-ts` stats module: pure statistical functions stay in `stats.ts`; DB-layer types (`VoteConnection`, `VoteQueryResult`) and `getGroupVoteMatrices` move to new `db.ts`. Unified `AnalysisOptions` (now includes `commentTextMap`) replaces two divergent options shapes. Collapsed `analyzeLabeledGroups` (was in `stats.ts`) and `calculateRepresentativeStatements` (was a thin wrapper in `representative-statements.ts`) into a single function in `representative-statements.ts`; app adapter updated to fold `commentTextMap` into options.
- Extracted dimensional reduction logic (types, config, and a pure `runReducer()` generator) into `reddwarf-ts`. `src/lib/druid-reducer.ts` becomes a named re-export shim; `src/lib/druid-reducer.worker.ts` becomes a thin message-protocol shell. `runReducer()` yields `ReducerResponse` events and is usable outside the browser (e.g. in Node.js scripts) without the web worker infrastructure. `@saehrimnir/druidjs` added as a runtime dependency of `reddwarf-ts`.
- Extracted core statistical functions (`stats.ts`, `representative-statements.ts`) into a standalone `reddwarf-ts` workspace package under `packages/`. The app now imports these from the package via a pnpm workspace link. `src/lib/stats.ts` becomes a re-export shim; `src/lib/representative-statements.ts` becomes a thin DuckDB adapter. No changes to the app's public API.
- Renamed `analyzePaintedClusters` → `analyzeLabeledGroups` in the package (neutral terminology; the app adapter preserves backward compat internally).

### Fixed

- Spotlight mode (desktop): scroll wheel now zooms the map when the circle is locked, matching the behavior of paint and move tools. Previously the wheel always resized the spotlight circle regardless of lock state.
- Spotlight mode (mobile): a quick tap now toggles the circle lock, mirroring the desktop click-to-lock mechanic. While locked, single-touch does not move the circle and two-finger pinch+pan zooms the map (keeping the ring over the same data region), instead of resizing the circle.
