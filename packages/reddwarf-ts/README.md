# reddwarf-ts

TypeScript library for polis-style representative statement and consensus analysis.

Algorithms originally derived from [raykyri/osccai-simulation](https://github.com/raykyri/osccai-simulation/tree/main/src/utils).

## What it does

Given a set of labeled participant groups and their votes on statements, this library:

- Computes per-group representative statements (repness metric)
- Identifies consensus statements agreed or disagreed upon across all groups
- Works with any source of group labels — k-means, HDBSCAN, manual assignment, etc.

The library is data-source agnostic: you bring your own database connection (e.g. DuckDB-WASM) and votes table.

## Installation

Install from the git repository using pnpm:

```bash
pnpm add 'github:patcon/polislike-human-cartography-prototype-v2#main' --filter reddwarf-ts
```

Or reference it in `package.json` directly:

```json
{
  "dependencies": {
    "reddwarf-ts": "github:patcon/polislike-human-cartography-prototype-v2#main&path=packages/reddwarf-ts"
  }
}
```

## Usage

```typescript
import { analyzeLabeledGroups } from 'reddwarf-ts';

// `conn` must satisfy the VoteConnection interface (e.g. a DuckDB AsyncDuckDBConnection)
// The votes table must already be loaded with columns: participant_id, comment_id, vote
const result = await analyzeLabeledGroups(conn, labelArray, undefined, participants);

console.log(result.repComments);        // per-group representative statements
console.log(result.consensusStatements); // agree/disagree consensus across all groups
console.log(result.groupVotes);          // raw vote matrices per group
```

### Label array

`labelArray` is a `(string | null)[]` aligned with `participants`. Each entry is the group label for that participant, or `null` to exclude them from analysis. Labels can come from any clustering algorithm or manual assignment.

### VoteConnection interface

```typescript
interface VoteConnection {
  query(sql: string): Promise<{
    numRows: number;
    getChild(name: string): { get(i: number): unknown } | null | undefined;
  }>;
}
```

The votes table queried must have columns `participant_id` (string), `comment_id` (string), and `vote` (integer: 1 agree, -1 disagree, 0 pass).

## API

### Core functions

| Function | Description |
|---|---|
| `analyzeLabeledGroups(conn, labelArray, commentTexts?, participants?, options?)` | Full pipeline: fetch votes, compute rep + consensus statements |
| `getGroupVoteMatrices(conn, labelArray, participants?)` | Fetch raw vote matrices per group |
| `calculateRepresentativeComments(groupVotes, commentTexts?, options?)` | Compute rep statements from pre-fetched votes |
| `selectConsensusStatements(groupVotes, ...)` | Select cross-group consensus statements |
| `selectRepComments(commentStatsWithTid, pickMax?, options?)` | Select top representative comments per group |

### Statistical primitives

`zSig90`, `twoPropTest`, `propTest`, `addComparativeStats`, `passesByTest`, `beatsBestByTest`, `beatsBestAgr`, `finalizeCommentStats`, `repnessMetric`, `isSignificant`

### Helpers (from `representative-statements`)

`calculateRepresentativeStatements`, `getLabelArrayWithOptionalUngrouped`, `hasEnoughGroupsForAnalysis`, `getAnalysisStatusMessage`, `formatRepresentativeStatementsForDisplay`, `createStatementTextMap`, `RepresentativeStatementsManager`
