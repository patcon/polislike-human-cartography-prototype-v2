import type { GroupVoteMatrix } from 'reddwarf-ts';
import type { ObsColumnInfo, LayerMatrix, H5adData } from './h5ad-loader';
import { PALETTE_COLOR_DEFINITIONS, UNPAINTED_VALUE } from '@/constants';

export type { VoteRow } from './parquet-reader';

export type RawDataInput = {
  /** Participant IDs (row order for the vote matrix) */
  obsNames: string[];
  /** Statement IDs (column order for the vote matrix) */
  varNames: string[];
  /** Sparse vote events */
  voteRows: { participant_id: string; comment_id: string; vote: number }[];
  statements: { statement_id: string; txt: string; moderated: number }[];
  obsColumns?: Record<string, ObsColumnInfo>;
  /** 2D embeddings: pipeline-style key → coords array parallel to obsNames */
  obsm?: Record<string, [number, number][]>;
  /** Full-dimension embeddings: pipeline-style key → coords array parallel to obsNames */
  fullDimensionObsm?: Record<string, number[][]>;
  layers?: Record<string, LayerMatrix>;
  conversationId?: string;
};

/**
 * Central in-memory AnnData store.
 *
 * Holds a dense vote matrix as Float32Array (NaN = no vote), with O(1) lookups
 * via index maps. Provides sync vote queries — no DuckDB required.
 */
export class AnnDataStore {
  readonly obsNames: string[];
  readonly varNames: string[];
  private readonly obsNameIdx: Map<string, number>;
  private readonly varNameIdx: Map<string, number>;
  private readonly voteMatrix: Float32Array; // shape (nObs, nVar), row-major

  readonly obsColumns: Record<string, ObsColumnInfo>;
  readonly statements: { statement_id: string; txt: string; moderated: number }[];
  /** 2D embeddings keyed by pipeline-style ID, parallel to obsNames */
  readonly obsm: Record<string, [number, number][]>;
  /** Full-dimension embeddings (>2D) keyed by pipeline-style ID, parallel to obsNames */
  readonly fullDimensionObsm: Record<string, number[][]>;
  readonly layers: Record<string, LayerMatrix>;
  readonly conversationId?: string;

  constructor(params: {
    obsNames: string[];
    varNames: string[];
    voteMatrix: Float32Array;
    obsColumns: Record<string, ObsColumnInfo>;
    statements: { statement_id: string; txt: string; moderated: number }[];
    obsm: Record<string, [number, number][]>;
    fullDimensionObsm: Record<string, number[][]>;
    layers: Record<string, LayerMatrix>;
    conversationId?: string;
  }) {
    this.obsNames = params.obsNames;
    this.varNames = params.varNames;
    this.obsNameIdx = new Map(params.obsNames.map((n, i) => [n, i]));
    this.varNameIdx = new Map(params.varNames.map((n, i) => [n, i]));
    this.voteMatrix = params.voteMatrix;
    this.obsColumns = params.obsColumns;
    this.statements = params.statements;
    this.obsm = params.obsm;
    this.fullDimensionObsm = params.fullDimensionObsm;
    this.layers = params.layers;
    this.conversationId = params.conversationId;
  }

  // ---------------------------------------------------------------------------
  // Builders
  // ---------------------------------------------------------------------------

  private static buildVoteMatrix(
    obsNames: string[],
    varNames: string[],
    voteRows: { participant_id: string; comment_id: string; vote: number }[]
  ): Float32Array {
    const nObs = obsNames.length;
    const nVar = varNames.length;
    const obsIdx = new Map(obsNames.map((n, i) => [n, i]));
    const varIdx = new Map(varNames.map((n, i) => [n, i]));
    const matrix = new Float32Array(nObs * nVar).fill(NaN);
    for (const { participant_id, comment_id, vote } of voteRows) {
      const row = obsIdx.get(participant_id);
      const col = varIdx.get(comment_id);
      if (row !== undefined && col !== undefined) {
        matrix[row * nVar + col] = vote;
      }
    }
    return matrix;
  }

  /** Build a store from an already-parsed H5adData object (h5ad import mode). */
  static fromH5adData(data: H5adData): AnnDataStore {
    const obsNames = data.dataset.map(([id]) => id);
    const varNames = data.varNames;
    const voteMatrix = AnnDataStore.buildVoteMatrix(obsNames, varNames, data.votesRows);

    const obsm: Record<string, [number, number][]> = {};
    for (const [key, entries] of Object.entries(data.allEmbeddings)) {
      obsm[key] = entries.map(([, coords]) => coords);
    }

    const fullDimensionObsm: Record<string, number[][]> = {};
    for (const [key, entries] of Object.entries(data.fullDimensionEmbeddings)) {
      fullDimensionObsm[key] = entries.map(([, coords]) => coords);
    }

    return new AnnDataStore({
      obsNames,
      varNames,
      voteMatrix,
      obsColumns: data.obsColumns,
      statements: data.statements,
      obsm,
      fullDimensionObsm,
      layers: data.layers,
      conversationId: data.conversationId,
    });
  }

  /** Build a store from raw data arrays (Kedro/local import modes). */
  static fromRawData(input: RawDataInput): AnnDataStore {
    const voteMatrix = AnnDataStore.buildVoteMatrix(
      input.obsNames, input.varNames, input.voteRows
    );
    return new AnnDataStore({
      obsNames: input.obsNames,
      varNames: input.varNames,
      voteMatrix,
      obsColumns: input.obsColumns ?? {},
      statements: input.statements,
      obsm: input.obsm ?? {},
      fullDimensionObsm: input.fullDimensionObsm ?? {},
      layers: input.layers ?? {},
      conversationId: input.conversationId,
    });
  }

  // ---------------------------------------------------------------------------
  // Vote queries (sync, replaces DuckDB)
  // ---------------------------------------------------------------------------

  /**
   * Get votes for a specific statement, optionally filtered to given participant IDs.
   * Returns participant_id → vote (-1/0/1). Missing votes are omitted.
   */
  getVotesForStatement(statementId: string, participantIds?: string[]): Map<string, number> {
    const col = this.varNameIdx.get(statementId);
    const result = new Map<string, number>();
    if (col === undefined) return result;
    const nVar = this.varNames.length;
    const ids = participantIds ?? this.obsNames;
    for (const pid of ids) {
      const row = this.obsNameIdx.get(pid);
      if (row === undefined) continue;
      const v = this.voteMatrix[row * nVar + col];
      if (!isNaN(v)) result.set(pid, v);
    }
    return result;
  }

  /**
   * Get normalized (0–1) vote count per participant.
   * Normalization is relative to the participant with the most votes.
   */
  getVoteCountsForAllParticipants(opts: { statementIds?: string[] } = {}): Map<string, number> {
    const nVar = this.varNames.length;
    const colSet = opts.statementIds
      ? new Set(
          opts.statementIds
            .map(id => this.varNameIdx.get(id))
            .filter((c): c is number => c !== undefined)
        )
      : null;

    const counts = new Map<string, number>();
    let maxCount = 0;
    for (let row = 0; row < this.obsNames.length; row++) {
      let count = 0;
      for (let col = 0; col < nVar; col++) {
        if (colSet && !colSet.has(col)) continue;
        if (!isNaN(this.voteMatrix[row * nVar + col])) count++;
      }
      counts.set(this.obsNames[row], count);
      if (count > maxCount) maxCount = count;
    }

    const normalized = new Map<string, number>();
    if (maxCount > 0) {
      counts.forEach((count, pid) => normalized.set(pid, count / maxCount));
    }
    return normalized;
  }

  /**
   * Expand vote rows from the dense matrix (for CSV export or analysis).
   */
  getAllVoteRows(): { participant_id: string; comment_id: string; vote: number }[] {
    const nVar = this.varNames.length;
    const rows: { participant_id: string; comment_id: string; vote: number }[] = [];
    for (let row = 0; row < this.obsNames.length; row++) {
      for (let col = 0; col < nVar; col++) {
        const v = this.voteMatrix[row * nVar + col];
        if (!isNaN(v)) {
          rows.push({ participant_id: this.obsNames[row], comment_id: this.varNames[col], vote: v });
        }
      }
    }
    return rows;
  }

  /**
   * Build GroupVoteMatrix records for each labeled group.
   * Used by representative-statements analysis.
   */
  getGroupVoteMatrices(
    labelArray: (string | null)[],
    participants: string[],
  ): Record<string, GroupVoteMatrix> {
    const nVar = this.varNames.length;
    const groups: Record<string, string[]> = {};
    labelArray.forEach((label, i) => {
      if (label != null) {
        const pid = participants[i];
        if (pid !== undefined) {
          if (!groups[label]) groups[label] = [];
          groups[label].push(pid);
        }
      }
    });

    const result: Record<string, GroupVoteMatrix> = {};
    for (const [label, pids] of Object.entries(groups)) {
      const matrix: GroupVoteMatrix = {};
      for (const pid of pids) {
        const row = this.obsNameIdx.get(pid);
        if (row === undefined) continue;
        const pidVotes: Record<string, number> = {};
        for (let col = 0; col < nVar; col++) {
          const v = this.voteMatrix[row * nVar + col];
          if (!isNaN(v)) {
            pidVotes[this.varNames[col]] = v;
          }
        }
        matrix[pid] = pidVotes;
      }
      result[label] = matrix;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // h5ad export
  // ---------------------------------------------------------------------------

  /**
   * Serialize the store to an h5ad-compatible HDF5 binary.
   * If paintedGroups is provided, merges a 'manual_painted' column into obs before writing.
   */
  async toH5adBytes(paintedGroups?: number[]): Promise<Uint8Array> {
    const h5wasm = await import('h5wasm');
    const { FS } = await h5wasm.ready;
    const { File: H5File } = await import('h5wasm');

    const filename = `export-${Date.now()}.h5ad`;
    const file = new H5File(filename, 'w');

    try {
      // --- obs group ---
      const obsGroup = file.create_group('obs') as import('h5wasm').Group;
      obsGroup.create_dataset({ name: '_index', data: this.obsNames });
      obsGroup.create_attribute('_index', '_index');

      for (const [colName, colInfo] of Object.entries(this.obsColumns)) {
        if (colInfo.type === 'categorical') {
          const catGroup = obsGroup.create_group(colName) as import('h5wasm').Group;
          const codes = colInfo.values.map(v => {
            if (v === null) return -1;
            const idx = colInfo.categories?.indexOf(v as string | number) ?? -1;
            return idx;
          });
          catGroup.create_dataset({ name: 'codes', data: new Int8Array(codes) });
          catGroup.create_dataset({ name: 'categories', data: (colInfo.categories ?? []).map(String) });
        } else {
          const values = colInfo.values.map(v => (v === null ? NaN : Number(v)));
          obsGroup.create_dataset({ name: colName, data: new Float64Array(values) });
        }
      }

      if (paintedGroups) {
        const paintedValues = paintedGroups.map(g =>
          g === UNPAINTED_VALUE ? '' : (PALETTE_COLOR_DEFINITIONS[g]?.name ?? String(g))
        );
        obsGroup.create_dataset({ name: 'manual_painted', data: paintedValues });
      }

      // --- var group ---
      const varGroup = file.create_group('var') as import('h5wasm').Group;
      varGroup.create_dataset({ name: '_index', data: this.varNames });
      varGroup.create_attribute('_index', '_index');
      const statByVarId = new Map(this.statements.map(s => [s.statement_id, s]));
      varGroup.create_dataset({
        name: 'content',
        data: this.varNames.map(id => statByVarId.get(id)?.txt ?? ''),
      });
      varGroup.create_dataset({
        name: 'moderation_state',
        data: new Int8Array(this.varNames.map(id => statByVarId.get(id)?.moderated ?? 0)),
      });

      // --- obsm group ---
      const obsmGroup = file.create_group('obsm') as import('h5wasm').Group;
      for (const [key, coords] of Object.entries(this.obsm)) {
        const nObs = coords.length;
        const flat = new Float32Array(nObs * 2);
        for (let i = 0; i < nObs; i++) {
          flat[i * 2] = coords[i][0];
          flat[i * 2 + 1] = coords[i][1];
        }
        obsmGroup.create_dataset({ name: `X_${key}`, data: flat, shape: [nObs, 2] });
      }

      // --- layers group ---
      const layersGroup = file.create_group('layers') as import('h5wasm').Group;
      for (const [key, layer] of Object.entries(this.layers)) {
        const data = layer.data instanceof Float32Array
          ? layer.data
          : new Float32Array(layer.data as ArrayLike<number>);
        layersGroup.create_dataset({ name: key, data, shape: layer.shape });
      }

      // --- uns group ---
      const unsGroup = file.create_group('uns') as import('h5wasm').Group;
      if (this.conversationId) {
        unsGroup.create_dataset({ name: 'conversation_id', data: [this.conversationId] });
      }

      const votesGroup = unsGroup.create_group('votes') as import('h5wasm').Group;
      const allVoteRows = this.getAllVoteRows();
      if (allVoteRows.length > 0) {
        votesGroup.create_dataset({ name: 'voter_id', data: allVoteRows.map(r => r.participant_id) });
        votesGroup.create_dataset({ name: 'comment_id', data: allVoteRows.map(r => r.comment_id) });
        votesGroup.create_dataset({ name: 'vote', data: new Int8Array(allVoteRows.map(r => r.vote)) });
      }
    } finally {
      file.close();
    }

    const bytes = FS.readFile(filename) as Uint8Array;
    try { FS.unlink(filename); } catch { /* ignore */ }
    return bytes;
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton (one dataset per app session)
// ---------------------------------------------------------------------------

let _store: AnnDataStore | null = null;

export function setAnnDataStore(store: AnnDataStore): void {
  _store = store;
}

export function getAnnDataStore(): AnnDataStore | null {
  return _store;
}

export function clearAnnDataStore(): void {
  _store = null;
}
