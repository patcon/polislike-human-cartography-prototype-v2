# reddwarf-ts

TypeScript library for polis-style representative statement and consensus analysis, plus in-browser dimensional reduction via DruidJS.

Algorithms originally derived from [raykyri/osccai-simulation](https://github.com/raykyri/osccai-simulation/tree/main/src/utils).

## What it does

Given a set of labeled participant groups and their votes on statements, this library:

- Computes per-group representative statements (repness metric)
- Identifies consensus statements agreed or disagreed upon across all groups
- Runs UMAP, PaCMAP, and LocalMAP dimensional reduction in a Web Worker
- Works with any source of group labels — k-means, HDBSCAN, manual assignment, etc.

The library is data-source agnostic: you bring your own database connection (e.g. DuckDB-WASM) and votes table.

## Installation

Install from the git repository using pnpm:

```bash
pnpm add 'github:patcon/polislike-human-cartography-prototype-v2#main&path=packages/reddwarf-ts'
```

Or reference it in `package.json` directly:

```json
{
  "dependencies": {
    "reddwarf-ts": "github:patcon/polislike-human-cartography-prototype-v2#main&path=packages/reddwarf-ts"
  }
}
```

To pin to a stable release, use a scoped tag instead of `main`:

```json
"reddwarf-ts": "github:patcon/polislike-human-cartography-prototype-v2#reddwarf-ts@0.1.0&path=packages/reddwarf-ts"
```

## Usage

### Representative statement analysis

The main entry point. Provide a DB connection, a label array, and participant IDs to get representative and consensus statements for each group.

```typescript
import { analyzeLabeledGroups } from 'reddwarf-ts';

// `conn` must satisfy the VoteConnection interface (e.g. a DuckDB AsyncDuckDBConnection).
// The votes table must be loaded with columns: participant_id, comment_id, vote.
const result = await analyzeLabeledGroups(conn, labelArray, undefined, participants);

console.log(result.repComments);         // per-group representative statements
console.log(result.consensusStatements); // agree/disagree consensus across all groups
console.log(result.groupVotes);          // raw vote matrices per group
```

`labelArray` is a `(string | null)[]` aligned with `participants`. Each entry is the group label for that participant, or `null` to exclude them. Labels can come from any clustering algorithm or manual assignment.

If you already have vote matrices fetched, you can skip straight to analysis:

```typescript
import { getGroupVoteMatrices, calculateRepresentativeComments, selectConsensusStatements } from 'reddwarf-ts';

const groupVotes = await getGroupVoteMatrices(conn, labelArray, participants);
const repComments = calculateRepresentativeComments(groupVotes, commentTexts);
const consensus = selectConsensusStatements(groupVotes);
```

#### VoteConnection interface

```typescript
interface VoteConnection {
  query(sql: string): Promise<{
    numRows: number;
    getChild(name: string): { get(i: number): unknown } | null | undefined;
  }>;
}
```

The votes table queried must have columns `participant_id` (string), `comment_id` (string), and `vote` (integer: 1 agree, -1 disagree, 0 pass).

### Dimensional reduction (pure, no React)

Use `runReducer` directly — it's a pure generator that yields progress ticks then a final `done` event. Works in a Web Worker or in Node.js.

```typescript
import { runReducer, defaultParamsFor } from 'reddwarf-ts';

const matrix: number[][] = /* rows = participants, cols = features */;
const params = defaultParamsFor('umap');

for (const event of runReducer({ type: 'reduce', matrix, algorithm: 'umap', params })) {
  if (event.type === 'progress') {
    console.log(`${event.iteration}/${event.total}`, event.coords);
  } else if (event.type === 'done') {
    console.log('final coords', event.coords); // [number, number][]
  } else {
    console.error('error', event.message);
  }
}
```

Supported algorithms: `"umap"`, `"pacmap"`, `"localmap"`.

Use `defaultParamsFor(algorithm)` and `defaultAdvancedParamsFor(algorithm)` to get starting parameter values. For PaCMAP/LocalMAP you can also supply a KNN backend:

```typescript
import { runReducer, defaultParamsFor, defaultKnnParamsFor } from 'reddwarf-ts';

for (const event of runReducer({
  type: 'reduce',
  matrix,
  algorithm: 'pacmap',
  params: defaultParamsFor('pacmap'),
  knnBackend: 'annoy',
  knnParams: defaultKnnParamsFor('annoy'),
})) { /* ... */ }
```

### Dimensional reduction with Web Worker (React hook)

The `reddwarf-ts/react` entry point exports `useDruidWorker`, a React hook that drives the worker automatically. **Requires React ≥18 and a Vite-based build** (the worker is bundled via Vite's `?worker` transform).

```tsx
import { useDruidWorker } from 'reddwarf-ts/react';

function MyComponent({ matrix }: { matrix: number[][] }) {
  const { status, coords, progress, error, runReduction, reset } = useDruidWorker();

  return (
    <>
      <button
        onClick={() => runReduction(matrix, 'umap', { n_neighbors: 15, min_dist: 0.1, _spread: 1.0 })}
        disabled={status === 'running'}
      >
        Run UMAP
      </button>

      {status === 'running' && progress !== null && (
        <progress value={progress} />
      )}
      {status === 'running' && progress === null && (
        <span>Building KNN graph…</span>
      )}
      {status === 'done' && coords && (
        <span>{coords.length} points ready</span>
      )}
      {status === 'error' && <span>Error: {error}</span>}
    </>
  );
}
```

The worker is created lazily on first `runReduction` call and terminated on unmount. `coords` is updated every 10 iterations during the run (live preview), and holds the final result when `status === 'done'`.

`runReduction` signature:

```typescript
runReduction(
  matrix: number[][],
  algorithm: ReducerAlgorithm,        // "umap" | "pacmap" | "localmap"
  params: Record<string, number>,
  knnBackend?: KnnBackend,            // "annoy" | "hnsw" — PaCMAP/LocalMAP only
  knnParams?: Record<string, number>
): void
```

## API reference

### Core analysis

| Function | Description |
|---|---|
| `analyzeLabeledGroups(conn, labelArray, commentTexts?, participants?, options?)` | Full pipeline: fetch votes, compute rep + consensus statements |
| `getGroupVoteMatrices(conn, labelArray, participants?)` | Fetch raw vote matrices per group |
| `calculateRepresentativeComments(groupVotes, commentTexts?, options?)` | Compute rep statements from pre-fetched votes |
| `selectConsensusStatements(groupVotes, ...)` | Select cross-group consensus statements |
| `selectRepComments(commentStatsWithTid, pickMax?, options?)` | Select top representative comments per group |

### Dimensional reduction

| Export | Description |
|---|---|
| `runReducer(req)` | Pure generator — yields progress ticks then `done`. Use in a worker or Node.js |
| `defaultParamsFor(algorithm)` | Default main params for a given algorithm |
| `defaultAdvancedParamsFor(algorithm)` | Default advanced params (epochs, seed, etc.) |
| `defaultKnnParamsFor(backend)` | Default KNN params for `"annoy"` or `"hnsw"` |
| `imputeColumnMeans(matrix)` | In-place mean imputation for NaN cells per column |
| `zeroMaskedColumns(matrix, mask)` | In-place zero-out of masked columns |
| `REDUCER_LABELS` | Human-readable algorithm names |
| `REDUCER_PARAM_DEFS` | Parameter definitions (label, min, max, step, default) per algorithm |
| `REDUCER_ADVANCED_PARAM_DEFS` | Advanced parameter definitions per algorithm |
| `KNN_PARAM_DEFS` | KNN parameter definitions per backend |
| `KNN_BACKENDS` | Available KNN backend descriptors |
| `KNN_BACKEND_ALGORITHMS` | Algorithms that support a KNN backend |
| `REDUCER_DEFAULT_ITERATIONS` | Default iteration count per algorithm |
| `PROGRESS_INTERVAL` | Iterations between progress ticks (10) |

### React (`reddwarf-ts/react`)

| Export | Description |
|---|---|
| `useDruidWorker()` | Hook that drives the reducer worker — returns `DruidWorkerState` |
| `DruidWorkerState` | Type for the hook return value |
| `DruidWorkerStatus` | `"idle" \| "running" \| "done" \| "error"` |

### Statistical primitives

`zSig90`, `twoPropTest`, `propTest`, `addComparativeStats`, `passesByTest`, `beatsBestByTest`, `beatsBestAgr`, `finalizeCommentStats`, `repnessMetric`, `isSignificant`

### Orchestration helpers

`calculateRepresentativeStatements`, `getLabelArrayWithOptionalUngrouped`, `hasEnoughGroupsForAnalysis`, `getAnalysisStatusMessage`, `formatRepresentativeStatementsForDisplay`, `createStatementTextMap`
