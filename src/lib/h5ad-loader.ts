import type { Group, Dataset, File as H5File } from 'h5wasm';
import h5wasm from 'h5wasm';

export type H5adData = {
  dataset: [string, [number, number]][];
  statements: { statement_id: string; txt: string; moderated: number }[];
  votesRows: { participant_id: string; comment_id: string; vote: number }[];
  availableEmbeddings: string[];
};

/**
 * Read the index (row/column names) from an AnnData group (obs or var).
 * AnnData stores the index column name in the `_index` attribute of the group,
 * then stores the actual values as a dataset with that name.
 */
function readIndex(group: Group): string[] {
  // Try reading the `_index` attribute to get the dataset name
  let indexDatasetName = '_index';
  try {
    const indexAttr = group.get_attribute('_index', true);
    if (typeof indexAttr === 'string') {
      indexDatasetName = indexAttr;
    }
  } catch {
    // Fall back to '_index' dataset name
  }

  const indexDataset = group.get(indexDatasetName);
  if (indexDataset && 'json_value' in indexDataset) {
    const val = (indexDataset as Dataset).json_value;
    if (Array.isArray(val)) {
      return val.map(String);
    }
  }

  throw new Error(`Could not read index from group at ${group.path}`);
}

/**
 * Read a column from an AnnData DataFrame group (obs or var).
 * Handles both plain datasets and categorical columns (stored as groups with codes + categories).
 */
function readColumn(parentGroup: Group, name: string): (string | number)[] {
  const item = parentGroup.get(name);
  if (!item) {
    throw new Error(`Column "${name}" not found in ${parentGroup.path}`);
  }

  // Categorical column: stored as a Group with `codes` and `categories` sub-datasets
  // Check by seeing if it has keys() method and contains 'codes'
  if ('keys' in item && typeof (item as Group).keys === 'function') {
    const asGroup = item as Group;
    const groupKeys = asGroup.keys();
    if (groupKeys.includes('codes') && groupKeys.includes('categories')) {
      const codesDs = asGroup.get('codes') as Dataset | null;
      const categoriesDs = asGroup.get('categories') as Dataset | null;
      if (!codesDs || !categoriesDs) {
        throw new Error(`Categorical column "${name}" missing codes or categories`);
      }
      const codes = codesDs.json_value;
      const categories = categoriesDs.json_value;
      if (!Array.isArray(codes) || !Array.isArray(categories)) {
        throw new Error(`Unexpected format for categorical column "${name}"`);
      }
      return (codes as number[]).map(code => {
        // -1 codes represent NaN/missing in pandas categoricals
        if (code < 0) return '';
        return categories[code] as string | number;
      });
    }
  }

  // Plain dataset
  if ('json_value' in item) {
    const val = (item as Dataset).json_value;
    if (Array.isArray(val)) {
      return val as (string | number)[];
    }
  }

  throw new Error(`Could not read column "${name}" from ${parentGroup.path}`);
}

/**
 * List available 2D embeddings in obsm/.
 * Returns keys where the second dimension is 2+ (suitable for 2D scatter plots).
 */
function listEmbeddingsFromFile(file: H5File): string[] {
  const obsm = file.get('obsm') as Group | null;
  if (!obsm) return [];

  const embeddings: string[] = [];
  for (const key of obsm.keys()) {
    const ds = obsm.get(key);
    if (ds && 'shape' in ds) {
      const shape = (ds as Dataset).shape;
      // Accept any embedding with 2 or more columns (we'll take the first 2)
      if (shape && shape.length === 2 && shape[1] >= 2) {
        embeddings.push(key);
      }
    }
  }
  return embeddings;
}

/**
 * Parse an h5ad (AnnData) file buffer into app-compatible data structures.
 *
 * @param buffer - ArrayBuffer of the h5ad file
 * @param embeddingKey - Key in obsm/ to use for 2D coordinates (default: auto-detect)
 * @returns Parsed data ready for the App component
 */
export async function loadH5adFile(
  buffer: ArrayBuffer,
  embeddingKey?: string
): Promise<H5adData> {
  const { FS } = await h5wasm.ready;

  // Write buffer to emscripten virtual filesystem
  const filename = 'upload.h5ad';
  FS.writeFile(filename, new Uint8Array(buffer));

  // Import File class at runtime (after ready resolves)
  const { File } = await import('h5wasm');

  let file: H5File | null = null;
  try {
    file = new File(filename, 'r');

    // --- Discover available embeddings ---
    const availableEmbeddings = listEmbeddingsFromFile(file);

    // --- Determine which embedding to use ---
    const preferredOrder = ['X_localmap', 'X_umap', 'X_pacmap'];
    let selectedEmbedding = embeddingKey;
    if (!selectedEmbedding) {
      selectedEmbedding = preferredOrder.find(k => availableEmbeddings.includes(k));
      if (!selectedEmbedding && availableEmbeddings.length > 0) {
        selectedEmbedding = availableEmbeddings[0];
      }
    }
    if (!selectedEmbedding) {
      throw new Error('No 2D embeddings found in obsm/');
    }

    // --- Read obs_names (participant IDs) ---
    const obsGroup = file.get('obs') as Group;
    if (!obsGroup) throw new Error('Missing /obs group');
    const obsNames = readIndex(obsGroup);

    // --- Read embedding coordinates ---
    const obsmGroup = file.get('obsm') as Group;
    if (!obsmGroup) throw new Error('Missing /obsm group');
    const embeddingDs = obsmGroup.get(selectedEmbedding) as Dataset | null;
    if (!embeddingDs) throw new Error(`Embedding "${selectedEmbedding}" not found in /obsm`);

    const shape = embeddingDs.shape;
    if (!shape || shape.length !== 2) {
      throw new Error(`Embedding "${selectedEmbedding}" has unexpected shape`);
    }
    const nObs = shape[0];
    const nDims = shape[1];

    // Read the flat typed array and reshape to [n_obs, 2]
    const rawValue = embeddingDs.value;
    let flatCoords: number[];
    if (ArrayBuffer.isView(rawValue)) {
      flatCoords = Array.from(rawValue as Float64Array | Float32Array);
    } else if (Array.isArray(rawValue)) {
      flatCoords = (rawValue as number[][]).flat();
    } else {
      throw new Error(`Unexpected embedding data format`);
    }

    const dataset: [string, [number, number]][] = [];
    for (let i = 0; i < nObs; i++) {
      const x = flatCoords[i * nDims];
      const y = flatCoords[i * nDims + 1];
      dataset.push([obsNames[i], [x, y]]);
    }

    // --- Read statements (var) ---
    const varGroup = file.get('var') as Group;
    if (!varGroup) throw new Error('Missing /var group');
    const varNames = readIndex(varGroup);

    // Read statement text - try 'content' then 'txt'
    let statementTexts: (string | number)[];
    const varKeys = varGroup.keys();
    if (varKeys.includes('content')) {
      statementTexts = readColumn(varGroup, 'content');
    } else if (varKeys.includes('txt')) {
      statementTexts = readColumn(varGroup, 'txt');
    } else {
      // Fall back to empty strings
      statementTexts = varNames.map(() => '');
    }

    // Read moderation state
    let moderationValues: (string | number)[];
    if (varKeys.includes('moderation_state')) {
      moderationValues = readColumn(varGroup, 'moderation_state');
    } else if (varKeys.includes('moderated')) {
      moderationValues = readColumn(varGroup, 'moderated');
    } else {
      // Default: all statements are non-moderated (0 = not moderated out)
      moderationValues = varNames.map(() => 0);
    }

    const statements = varNames.map((id, i) => ({
      statement_id: id,
      txt: String(statementTexts[i]),
      moderated: parseModerationValue(moderationValues[i]),
    }));

    // Sort statements by statement_id (integer sort when possible)
    statements.sort((a, b) => {
      const aInt = parseInt(a.statement_id, 10);
      const bInt = parseInt(b.statement_id, 10);
      if (!isNaN(aInt) && !isNaN(bInt)) return aInt - bInt;
      return a.statement_id.localeCompare(b.statement_id);
    });

    // --- Read votes from uns/votes ---
    const votesRows = readVotes(file);

    return { dataset, statements, votesRows, availableEmbeddings };
  } finally {
    if (file) {
      file.close();
    }
    // Clean up the virtual filesystem
    try {
      FS.unlink(filename);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Find the first matching key from a list of candidates.
 */
function findKey(available: string[], candidates: string[]): string | undefined {
  return candidates.find(k => available.includes(k));
}

/**
 * Read votes DataFrame from uns/votes.
 * Handles both hyphenated (valency-anndata: voter-id, comment-id) and
 * underscored (voter_id, comment_id, participant_id) column naming conventions.
 */
function readVotes(file: H5File): H5adData['votesRows'] {
  const unsGroup = file.get('uns') as Group | null;
  if (!unsGroup) return [];

  const votesGroup = unsGroup.get('votes') as Group | null;
  if (!votesGroup) return [];

  const votesKeys = votesGroup.keys();

  // Read participant IDs - try multiple naming conventions
  const participantKey = findKey(votesKeys, ['voter-id', 'voter_id', 'participant_id', 'participant-id']);
  if (!participantKey) {
    console.warn('No voter/participant ID column found in uns/votes. Available keys:', votesKeys);
    return [];
  }
  const participantIds = readColumn(votesGroup, participantKey);

  // Read comment/statement IDs
  const commentKey = findKey(votesKeys, ['comment-id', 'comment_id', 'statement_id', 'statement-id']);
  if (!commentKey) {
    console.warn('No comment/statement ID column found in uns/votes. Available keys:', votesKeys);
    return [];
  }
  const commentIds = readColumn(votesGroup, commentKey);

  // Read vote values
  const voteKey = findKey(votesKeys, ['vote', 'votes']);
  if (!voteKey) {
    console.warn('No vote column found in uns/votes. Available keys:', votesKeys);
    return [];
  }
  const votes = readColumn(votesGroup, voteKey);

  const rows: H5adData['votesRows'] = [];
  for (let i = 0; i < participantIds.length; i++) {
    rows.push({
      participant_id: String(participantIds[i]),
      comment_id: String(commentIds[i]),
      vote: Number(votes[i]),
    });
  }
  return rows;
}

/**
 * Convert moderation value from h5ad to the numeric format expected by the app.
 * In the app: -1 = moderated out, 0 = not moderated, 1 = accepted
 */
function parseModerationValue(value: string | number): number {
  if (typeof value === 'number') return value;
  const lower = String(value).toLowerCase();
  if (lower === 'rejected' || lower === 'moderated') return -1;
  if (lower === 'accepted' || lower === 'approved') return 1;
  return 0;
}
