# Perspective Landscape Painter (Redesign)

## Current Near-Term

The purpose of this project is to make a map-like interface for exploring perspective maps built from polis-like opinion data.

Live demo of work-in-process newer interface:
https://main--68c53b7909ee2fb48f1979dd.chromatic.com/iframe.html?globals=&args=&id=components-app--default&viewMode=story

2025-09-15 recorded feature walk-through:
https://youtube.com/shorts/cd0Qtzg-0ik

## Data Format

The app imports `.h5ad` (AnnData) files following the [valency-anndata data model](https://github.com/patcon/valency-anndata/blob/main/.claude/skills/valency-anndata/references/data-model.md). You can generate compatible files using the [valency-anndata](https://github.com/patcon/valency-anndata) Python library or the [Streamlit export tool](https://valency-anndata-export-test.streamlit.app/).

**Required h5ad structure:**

| AnnData slot | What the app reads | Description |
|---|---|---|
| `obs` (index) | Participant IDs | Row names used as voter identifiers |
| `obs` (columns) | All metadata columns | Exposed for metrics layers (e.g. `n_votes`, `mean_vote`, cluster labels) |
| `var` (index) | Statement IDs | Column names used as statement identifiers |
| `var.content` | Statement text | Falls back to `var.txt` if `content` is missing |
| `var.moderation_state` | Moderation status | -1=moderated out, 0=active; falls back to `var.moderated` |
| `obsm/X_*` | 2D embeddings | At least one 2D embedding required (e.g. `X_umap`, `X_pacmap`, `X_localmap`) |
| `uns/votes` | Raw vote events | DataFrame with `voter-id`/`comment-id`/`vote` columns (-1=disagree, 0=pass, +1=agree) |

## Future Medium-Term

A sub-goal is to allow people to build intuitions about trade-offs of various algorithms and their parameters, during the data processing pipeline.

Demo of parameter exploration interface:
https://patcon.github.io/polis-param-chooser-component/
