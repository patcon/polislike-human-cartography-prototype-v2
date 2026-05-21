# Changelog

## [Unreleased]

### Changed

- `runReducer` now spreads params directly into DruidJS constructors using the library's own `ParametersUMAP`/`ParametersPaCMAP`/`ParametersLocalMAP` types, replacing manual field-by-field enumeration. The UMAP `spread` param key was renamed to `_spread` to match the DruidJS type.

## [0.1.0] - 2026-05-16

### Added

- Initial extraction from [polislike-human-cartography-prototype-v2](https://github.com/patcon/polislike-human-cartography-prototype-v2). Algorithms originally derived from [raykyri/osccai-simulation](https://github.com/raykyri/osccai-simulation/tree/main/src/utils).
- `analyzeLabeledGroups` — full pipeline: fetch vote matrices via a `VoteConnection`, compute representative and consensus statements.
- `getGroupVoteMatrices` — query votes per label group from a DuckDB-compatible connection.
- `calculateRepresentativeComments` — compute per-group representative statements from pre-fetched vote matrices.
- `selectRepComments` — rank and select top representative comments per group, with fallback to best-scoring statement when no statement passes significance.
- `selectConsensusStatements` — identify statements agreed or disagreed upon across all groups.
- `isSignificant` — delegates to `zSig90` for consistent one-tailed 90% confidence threshold.
- `zSig90`, `twoPropTest`, `propTest`, `addComparativeStats`, `passesByTest`, `beatsBestByTest`, `beatsBestAgr`, `finalizeCommentStats`, `repnessMetric` — statistical primitives.
- `VoteConnection` / `VoteQueryResult` interfaces for DuckDB-agnostic connection typing.
- `calculateRepresentativeStatements`, `getLabelArrayWithOptionalUngrouped`, `hasEnoughGroupsForAnalysis`, `getAnalysisStatusMessage`, `formatRepresentativeStatementsForDisplay`, `createStatementTextMap`, `RepresentativeStatementsManager` — orchestration helpers.

### Changed

- `zSig90` threshold corrected to `1.2816` (one-tailed 90% confidence), matching the authoritative polis implementation. The prior value of `1.645` was the two-tailed threshold and produced overly conservative results.
- `selectConsensusStatements` `confidence` parameter removed; significance is always tested via `zSig90`.
