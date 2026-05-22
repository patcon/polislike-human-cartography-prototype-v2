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
  /** Raw HDF5 bytes of the original file. When present, used as the base for export. */
  readonly rawH5adBytes?: Uint8Array;

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
    rawH5adBytes?: Uint8Array;
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
    this.rawH5adBytes = params.rawH5adBytes;
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
      rawH5adBytes: data.rawBytes,
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
    const { File: H5File, Group, Dataset } = await import('h5wasm');

    const ts = Date.now();
    const srcFilename = `src-${ts}.h5ad`;
    const dstFilename = `dst-${ts}.h5ad`;

    // Copy readable children and attributes from srcGroup → dstGroup, skipping skipKeys.
    // Handles both plain datasets and sub-groups (e.g. AnnData categorical columns).
    function copyGroupContents(
      srcGroup: import('h5wasm').Group,
      dstGroup: import('h5wasm').Group,
      skipKeys: Set<string> = new Set(),
    ) {
      // Copy HDF5 attributes (encoding-type, encoding-version, _index, etc.)
      for (const [attrName, attrVal] of Object.entries(srcGroup.attrs)) {
        try {
          dstGroup.create_attribute(attrName, attrVal.value as unknown as Parameters<typeof dstGroup.create_attribute>[1]);
        } catch { /* skip unwritable attrs */ }
      }
      for (const key of srcGroup.keys()) {
        if (skipKeys.has(key)) continue;
        const child = srcGroup.get(key);
        if (!child) continue;
        if (child instanceof Group) {
          const subDst = dstGroup.create_group(key) as import('h5wasm').Group;
          copyGroupContents(child, subDst);
        } else if (child instanceof Dataset) {
          try {
            const val = child.value;
            if (val != null) {
              dstGroup.create_dataset({ name: key, data: val as Parameters<typeof dstGroup.create_dataset>[0]['data'] });
            }
          } catch { /* skip unreadable datasets */ }
        }
      }
    }

    let srcFile: import('h5wasm').File | null = null;
    const dstFile = new H5File(dstFilename, 'w');

    try {
      if (this.rawH5adBytes) {
        FS.writeFile(srcFilename, this.rawH5adBytes);
        srcFile = new H5File(srcFilename, 'r');
      }

      // --- obs group ---
      // Written entirely from AnnDataStore so manual_painted is always current.
      const dstObsGroup = dstFile.create_group('obs') as import('h5wasm').Group;
      dstObsGroup.create_dataset({ name: '_index', data: this.obsNames });
      dstObsGroup.create_attribute('_index', '_index');

      // Preserve group-level HDF5 attributes from the source obs group.
      if (srcFile) {
        const srcObsGroup = srcFile.get('obs') as import('h5wasm').Group | null;
        if (srcObsGroup) {
          for (const [attrName, attrVal] of Object.entries(srcObsGroup.attrs)) {
            if (attrName === '_index') continue;
            try {
              dstObsGroup.create_attribute(attrName, attrVal.value as unknown as Parameters<typeof dstObsGroup.create_attribute>[1]);
            } catch { /* skip */ }
          }
        }
      }

      for (const [colName, colInfo] of Object.entries(this.obsColumns)) {
        if (colInfo.type === 'categorical') {
          const catGroup = dstObsGroup.create_group(colName) as import('h5wasm').Group;
          const codes = colInfo.values.map(v => {
            if (v === null) return -1;
            const idx = colInfo.categories?.indexOf(v as string | number) ?? -1;
            return idx;
          });
          catGroup.create_dataset({ name: 'codes', data: new Int8Array(codes) });
          catGroup.create_dataset({ name: 'categories', data: (colInfo.categories ?? []).map(String) });
        } else {
          const values = colInfo.values.map(v => (v === null ? NaN : Number(v)));
          dstObsGroup.create_dataset({ name: colName, data: new Float64Array(values) });
        }
      }

      if (paintedGroups) {
        const paintedValues = paintedGroups.map(g =>
          g === UNPAINTED_VALUE ? '' : (PALETTE_COLOR_DEFINITIONS[g]?.name ?? String(g))
        );
        // manual_painted is already omitted from obsColumns (loaded as a column but
        // overwritten here so the current painting state always wins).
        try { dstObsGroup.create_dataset({ name: 'manual_painted', data: paintedValues }); }
        catch { /* column already written from obsColumns — shouldn't happen */ }
      }

      // --- var group ---
      // Write the index and the two fields we track, then copy any extra columns
      // from the source file (preserves group-stats, z-scores, etc.).
      const dstVarGroup = dstFile.create_group('var') as import('h5wasm').Group;
      dstVarGroup.create_dataset({ name: '_index', data: this.varNames });
      dstVarGroup.create_attribute('_index', '_index');
      const statByVarId = new Map(this.statements.map(s => [s.statement_id, s]));
      dstVarGroup.create_dataset({
        name: 'content',
        data: this.varNames.map(id => statByVarId.get(id)?.txt ?? ''),
      });
      dstVarGroup.create_dataset({
        name: 'moderation_state',
        data: new Int8Array(this.varNames.map(id => statByVarId.get(id)?.moderated ?? 0)),
      });

      if (srcFile) {
        const srcVarGroup = srcFile.get('var') as import('h5wasm').Group | null;
        if (srcVarGroup) {
          const indexCol = (srcVarGroup.attrs['_index']?.value as unknown as string) ?? '_index';
          const handled = new Set([indexCol, '_index', 'content', 'txt', 'moderation_state', 'moderated']);
          copyGroupContents(srcVarGroup, dstVarGroup, handled);
        }
      }

      // --- obsm group ---
      // Write full-dimensional embeddings where available, then 2D for the rest.
      // Any obsm key in the source that isn't in AnnDataStore is also copied through.
      const dstObsmGroup = dstFile.create_group('obsm') as import('h5wasm').Group;
      const writtenObsmKeys = new Set<string>();

      // Full-dimensional embeddings (PCA etc.) take priority.
      for (const [key, coordRows] of Object.entries(this.fullDimensionObsm)) {
        const h5Key = `X_${key}`;
        const nObs = coordRows.length;
        const nDims = coordRows[0]?.length ?? 0;
        const flat = new Float32Array(nObs * nDims);
        for (let i = 0; i < nObs; i++) {
          for (let d = 0; d < nDims; d++) flat[i * nDims + d] = coordRows[i][d];
        }
        dstObsmGroup.create_dataset({ name: h5Key, data: flat, shape: [nObs, nDims] });
        writtenObsmKeys.add(h5Key);
      }

      // 2D-only embeddings (user-computed projections that have no high-dim counterpart).
      for (const [key, coords] of Object.entries(this.obsm)) {
        const h5Key = `X_${key}`;
        if (writtenObsmKeys.has(h5Key)) continue;
        const nObs = coords.length;
        const flat = new Float32Array(nObs * 2);
        for (let i = 0; i < nObs; i++) { flat[i * 2] = coords[i][0]; flat[i * 2 + 1] = coords[i][1]; }
        dstObsmGroup.create_dataset({ name: h5Key, data: flat, shape: [nObs, 2] });
        writtenObsmKeys.add(h5Key);
      }

      // Copy any obsm entries from the source that weren't in AnnDataStore.
      if (srcFile) {
        const srcObsmGroup = srcFile.get('obsm') as import('h5wasm').Group | null;
        if (srcObsmGroup) copyGroupContents(srcObsmGroup, dstObsmGroup, writtenObsmKeys);
      }

      // --- layers group ---
      const dstLayersGroup = dstFile.create_group('layers') as import('h5wasm').Group;
      for (const [key, layer] of Object.entries(this.layers)) {
        const data = layer.data instanceof Float32Array
          ? layer.data
          : new Float32Array(layer.data as ArrayLike<number>);
        dstLayersGroup.create_dataset({ name: key, data, shape: layer.shape });
      }

      // --- uns group ---
      // Write votes + conversation_id from AnnDataStore; copy remaining uns from source.
      const dstUnsGroup = dstFile.create_group('uns') as import('h5wasm').Group;
      if (this.conversationId) {
        dstUnsGroup.create_dataset({ name: 'conversation_id', data: [this.conversationId] });
      }
      const votesGroup = dstUnsGroup.create_group('votes') as import('h5wasm').Group;
      const allVoteRows = this.getAllVoteRows();
      if (allVoteRows.length > 0) {
        votesGroup.create_dataset({ name: 'voter_id', data: allVoteRows.map(r => r.participant_id) });
        votesGroup.create_dataset({ name: 'comment_id', data: allVoteRows.map(r => r.comment_id) });
        votesGroup.create_dataset({ name: 'vote', data: new Int8Array(allVoteRows.map(r => r.vote)) });
      }

      if (srcFile) {
        const srcUnsGroup = srcFile.get('uns') as import('h5wasm').Group | null;
        if (srcUnsGroup) copyGroupContents(srcUnsGroup, dstUnsGroup, new Set(['conversation_id', 'votes']));
      }
    } finally {
      dstFile.close();
      srcFile?.close();
    }

    const bytes = FS.readFile(dstFilename) as Uint8Array;
    try { FS.unlink(dstFilename); } catch { /* ignore */ }
    if (this.rawH5adBytes) try { FS.unlink(srcFilename); } catch { /* ignore */ }
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
