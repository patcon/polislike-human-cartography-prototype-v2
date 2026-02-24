# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A map-like interface for exploring perspective maps built from polis-like opinion data. Users can paint participant groups on a 2D projection, view per-statement vote overlays, and explore representative statements via DuckDB-WASM queries. A secondary interface allows exploring trade-offs of various algorithms and their parameters during the data processing pipeline.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run dev:tunnel   # Start Vite + localtunnel for mobile testing
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint (flat config, TS/TSX files)
npm run test         # Vitest in watch mode (jsdom environment)
npm run test:run     # Vitest single run (CI-friendly)
npm run storybook    # Storybook dev server on port 6006
npm run deploy       # Build and deploy to GitHub Pages via gh-pages
```

## Architecture

### Two Main Apps (Hash-Routed)

The entry point `src/index.tsx` renders a showcase lander (`src/components/showcase-lander/App.tsx`) that hash-routes between:

- **Perspective Explorer** (`#perspective-explorer`) — `src/components/convo-explorer/App.tsx`: The primary app. D3-powered SVG map where users lasso-paint participant groups, view vote heatmaps per statement, and see metrics layers. Manages complex state for point groups, votes, metrics, pipeline selection, and representative statement calculation.
- **Parameter Explorer** (`#parameter-explorer`) — `src/components/param-explorer/ParameterExplorerApp.tsx`: Side-by-side comparison of different algorithm parameter configurations.

### Data Flow

- **h5ad (AnnData) mode**: Users can import `.h5ad` files via the UI. The loader (`src/lib/h5ad-loader.ts`) reads all data from a single file using h5wasm. The expected format follows the [valency-anndata data model](https://github.com/patcon/valency-anndata/blob/main/.claude/skills/valency-anndata/references/data-model.md). Key fields consumed:
  - **obs (participants)**: Index used as participant IDs. All metadata columns are read and exposed for metrics layers.
  - **var (statements)**: Index used as statement IDs. Reads `content` (or `txt`) for statement text, `moderation_state` (or `moderated`) for filtering.
  - **obsm (embeddings)**: All 2D+ embeddings are loaded. The app prefers `X_localmap` > `X_umap` > `X_pacmap` as default, with a dropdown to switch. Higher-dimensional embeddings (e.g. PCA) are also stored for metrics.
  - **uns/votes**: Raw vote events DataFrame with columns `voter-id`/`voter_id`, `comment-id`/`comment_id`, and `vote`. Values: -1=disagree, 0=pass, +1=agree.
  - **X matrix**: Not read directly by the app (votes come from `uns/votes`).
- **Local mode**: Loads `public/projections.json` and `public/statements.json` at startup.
- **Kedro mode**: Fetches projection/statement data from a Kedro API (`src/lib/kedro-api.ts`). Stories pass `kedroBaseUrl` prop. URL args are encoded/decoded via helpers in `.storybook/preview.ts` to work around Storybook URL parameter limitations.
- **DuckDB-WASM** (`src/lib/duckdb.ts`): Initialized on mount, loads votes from Parquet files, provides SQL queries for vote counts and per-participant vote data.

### Key Libraries

- **D3** for the main SVG scatter/map visualization (`src/components/convo-explorer/D3Map.tsx`)
- **DuckDB-WASM** for in-browser SQL queries on vote Parquet data
- **shadcn/ui** (new-york style) with Radix primitives — components in `src/components/ui/`
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin

### Layer Modes

The convo-explorer D3Map supports three layer modes controlled by `layerMode` state:
- `"groups"` — user-painted color groups (lasso tool)
- `"votes"` — per-statement agree/disagree/pass heatmap
- `"metrics"` — vote-count or principal-component intensity

### Lib Modules

- `src/lib/stats.ts` / `src/lib/vote-stats.ts` — statistical calculations for representative statements
- `src/lib/representative-statements.ts` — finds distinguishing statements per painted group using DuckDB
- `src/lib/kedro-api.ts` — fetches and decodes Plotly typed arrays from Kedro Viz endpoints
- `src/lib/google-translate-utils.ts` — workarounds for Google Translate DOM mutation conflicts with React

### Storybook & Chromatic

Stories live next to their components (`*.stories.tsx`). Chromatic is used for visual regression testing. Static files served from `public/` in Storybook via `staticDirs`.

### Path Aliases

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

### Test Setup

Tests use Vitest with jsdom. `src/test-setup.ts` mocks `matchMedia`, `ResizeObserver`, `IntersectionObserver`, and SVG methods (`getBBox`, `getComputedTextLength`).

### Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com) conventions with `Added`, `Changed`, and `Fixed` subsections under each release.

- **Every feature branch must include a `CHANGELOG.md` update** in the same commit (or PR) as the code change.
- **Claude must always update `CHANGELOG.md`** when implementing any feature, fix, or notable change — without waiting to be asked.
- Entries go under `## [Unreleased]` until a version is tagged.
- Link each entry to its GitHub issue (`[#27](.../issues/27)`) if one exists, otherwise fall back to the PR (`[#42](.../pull/42)`).
- On release: rename `[Unreleased]` to the new version + date, update its compare URL to `compare/vPREV...vNEW`, and add a fresh empty `[Unreleased]` block at the top pointing to `compare/vNEW...main`.

### Python Scripts

`scripts/python/` contains HDBSCAN clustering scripts for generating water-level threshold data used by the MagicPaintExperiment. Uses `uv` for package management (`cd scripts/python && uv sync`).
