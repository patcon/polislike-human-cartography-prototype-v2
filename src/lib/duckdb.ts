import * as duckdb from '@duckdb/duckdb-wasm';
import { VOTE_COLORS } from '../constants';
import { resolveAssetPath, getAssetUrl } from './paths';
import { getVotesParquetPath } from './kedro-api';

// DuckDB instance and connection
let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

// Track if votes table has been loaded
let votesTableLoaded = false;
let lastVotesConfig: string | null = null;

/**
 * Initialize DuckDB WASM instance
 */
export async function initializeDuckDB(): Promise<void> {
  if (db) return; // Already initialized

  try {
    // Create local bundle configuration to avoid CORS issues
    const LOCAL_BUNDLES: duckdb.DuckDBBundles = {
      mvp: {
        mainModule: resolveAssetPath('/duckdb/duckdb-mvp.wasm'),
        mainWorker: resolveAssetPath('/duckdb/duckdb-browser-mvp.worker.js'),
      },
      eh: {
        mainModule: resolveAssetPath('/duckdb/duckdb-eh.wasm'),
        mainWorker: resolveAssetPath('/duckdb/duckdb-browser-eh.worker.js'),
      },
      coi: {
        mainModule: resolveAssetPath('/duckdb/duckdb-coi.wasm'),
        mainWorker: resolveAssetPath('/duckdb/duckdb-browser-coi.worker.js'),
        pthreadWorker: resolveAssetPath('/duckdb/duckdb-browser-coi.pthread.worker.js'),
      },
    };

    // Select bundle based on browser support
    const bundle = await duckdb.selectBundle(LOCAL_BUNDLES);

    // Instantiate the asynchronous version of DuckDB-wasm
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    // Create a connection
    conn = await db.connect();

    console.log('DuckDB initialized successfully with local files');
  } catch (error) {
    console.error('Failed to initialize DuckDB:', error);
    // Don't throw in development environments to prevent component crashes
    const isDev = import.meta.env.DEV;
    if (!isDev) {
      throw error;
    }
  }
}

/**
 * Get the current DuckDB instance
 */
export function getDB(): duckdb.AsyncDuckDB | null {
  return db;
}

/**
 * Get the current DuckDB connection
 */
export function getConnection(): duckdb.AsyncDuckDBConnection | null {
  return conn;
}

/**
 * Ensure votes table is loaded (only loads once per configuration)
 */
export async function ensureVotesTableLoaded(kedroBaseUrl?: string, pipelineId?: string): Promise<void> {
  // Create a unique key for this configuration
  const configKey = `${kedroBaseUrl || 'local'}:${pipelineId || 'default'}`;

  // Check if we've already loaded votes for this exact configuration
  if (votesTableLoaded && lastVotesConfig === configKey) {
    return; // Already loaded for this configuration
  }

  // Reset the loaded flag if configuration changed
  if (lastVotesConfig !== configKey) {
    votesTableLoaded = false;
    console.log('🔄 Votes configuration changed, will reload votes table');
  }

  if (!conn) {
    await initializeDuckDB();
  }

  try {
    let votesUrl: string;

    if (kedroBaseUrl) {
      // Use Kedro API to get the votes parquet file path
      console.log('Getting votes parquet path from Kedro API...');
      const relativePath = await getVotesParquetPath(kedroBaseUrl, pipelineId);
      // Convert relative path to full URL (assuming it's relative to the Kedro base URL)
      votesUrl = `${kedroBaseUrl}/${relativePath}`;
    } else {
      // Fallback to hardcoded local path
      votesUrl = getAssetUrl('/votes.parquet');
    }

    console.log('Loading votes table from:', votesUrl);

    await conn!.query(`
      CREATE OR REPLACE TABLE votes AS
      SELECT * FROM read_parquet('${votesUrl}')
    `);

    votesTableLoaded = true;
    lastVotesConfig = configKey;
    console.log('✅ Votes table loaded successfully for config:', configKey);
  } catch (error) {
    console.error('Failed to load votes table:', error);
    throw new Error('Failed to load votes data');
  }
}

/**
 * Load parquet file into DuckDB
 */
export async function loadParquetFile(filePath: string, tableName: string): Promise<void> {
  if (!conn) {
    await initializeDuckDB();
  }

  try {
    // Create table from parquet file
    await conn!.query(`
      CREATE OR REPLACE TABLE ${tableName} AS
      SELECT * FROM read_parquet('${filePath}')
    `);

    console.log(`Loaded parquet file ${filePath} into table ${tableName}`);
  } catch (error) {
    console.error(`Failed to load parquet file ${filePath}:`, error);
    // Don't throw in development environments
    const isDev = import.meta.env.DEV;
    if (!isDev) {
      throw error;
    }
  }
}

/**
 * Get votes for specific participants and statement
 * @param statementId - The statement ID to get votes for
 * @param participantIds - Array of participant IDs to get votes for
 * @param kedroBaseUrl - Optional Kedro base URL for API access
 * @param pipelineId - Optional pipeline ID for Kedro API
 * @returns Map of participant IDs to their votes
 */
export async function getVotesForParticipants(
  statementId: string,
  participantIds: string[],
  kedroBaseUrl?: string,
  pipelineId?: string
): Promise<Map<string, number>> {
  if (!conn) {
    await initializeDuckDB();
  }

  try {
    // Ensure votes table is loaded (uses optimized single-load function)
    await ensureVotesTableLoaded(kedroBaseUrl, pipelineId);

    // Create a comma-separated list of participant IDs for the IN clause
    const participantIdList = participantIds.map(id => `'${id}'`).join(',');

    // Query votes for the specific statement and participants in one go
    const result = await conn!.query(`
      SELECT participant_id, vote
      FROM votes
      WHERE comment_id = '${statementId}'
        AND participant_id IN (${participantIdList})
    `);

    const votes = new Map<string, number>();

    // Process the results
    for (let i = 0; i < result.numRows; i++) {
      const participantId = result.getChild('participant_id')?.get(i)?.toString();
      const rawVote = result.getChild('vote')?.get(i);

      // Convert BigInt to number if needed
      const vote = typeof rawVote === 'bigint' ? Number(rawVote) : rawVote as number;

      if (participantId !== undefined && vote !== undefined) {
        votes.set(participantId, vote);
      }
    }

    console.log(`Found ${votes.size} votes for statement ${statementId} from ${participantIds.length} participants`);
    return votes;
  } catch (error) {
    console.error(`Failed to get votes for statement ${statementId}:`, error);
    // Return empty map instead of throwing in development
    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.warn('Returning empty votes map due to error in development environment');
      return new Map<string, number>();
    }
    throw error;
  }
}



/**
 * Convert vote number to vote type string
 */
function getVoteType(vote: number): keyof typeof VOTE_COLORS {
  switch (vote) {
    case 1:
      return 'agree';
    case -1:
      return 'disagree';
    case 0:
    default:
      return 'pass';
  }
}

/**
 * Get participant data with votes and colors for a specific statement
 * More efficient approach: load all projections first, then query votes for those participants
 * @param statementId - The statement ID to get data for
 * @param kedroBaseUrl - Optional Kedro base URL for API access
 * @param pipelineId - Optional pipeline ID for Kedro API
 * @returns Array of participant data with coordinates, votes, and colors
 */
export async function getParticipantDataForStatement(
  statementId: string,
  kedroBaseUrl?: string,
  pipelineId?: string
): Promise<Array<{
  participantId: string;
  coordinates: [number, number];
  vote: number | null;
  voteType: keyof typeof VOTE_COLORS;
  color: string;
}>> {
  try {
    // First load all projections to get the participant IDs
    const { loadProjections } = await import('./kedro-api');
    const projections = await loadProjections();
    const participantIds = Array.from(projections.keys());

    // Then get votes for all those participants in a single query
    const votes = await getVotesForParticipants(statementId, participantIds, kedroBaseUrl, pipelineId);

    const participantData: Array<{
      participantId: string;
      coordinates: [number, number];
      vote: number | null;
      voteType: keyof typeof VOTE_COLORS;
      color: string;
    }> = [];

    // Process all participants from projections, maintaining order
    projections.forEach((coordinates, participantId) => {
      const vote = votes.get(participantId) ?? null; // null if no vote found

      // Only assign vote type and color if participant actually voted
      let voteType: keyof typeof VOTE_COLORS;
      let color: string;

      if (vote !== null) {
        // Participant has a vote: -1=disagree(red), 0=pass(yellow), 1=agree(green)
        voteType = getVoteType(vote);
        color = VOTE_COLORS[voteType];
      } else {
        // Participant has no vote record - should be black like ungrouped participants
        voteType = 'pass'; // This is just for the data structure consistency
        color = 'black';
      }

      participantData.push({
        participantId,
        coordinates,
        vote,
        voteType,
        color
      });
    });

    console.log(`Processed ${participantData.length} participants (${votes.size} with votes) for statement ${statementId}`);
    return participantData;
  } catch (error) {
    console.error(`Failed to get participant data for statement ${statementId}:`, error);
    throw error;
  }
}

/**
 * Get vote counts for all participants (normalized 0-1 for metrics visualization)
 *
 * Note: When statementIds filter is applied, normalization is based on the maximum
 * vote count within the filtered set of statements, not the original total.
 * This means the metric represents participation rate within the available statements.
 *
 * @param options - Configuration options
 * @param options.kedroBaseUrl - Optional Kedro base URL for API access
 * @param options.pipelineId - Optional pipeline ID for Kedro API
 * @param options.statementIds - Optional array of statement IDs to filter by
 * @returns Map of participant IDs to normalized vote counts (0-1)
 */
export async function getVoteCountsForAllParticipants(
  options: {
    kedroBaseUrl?: string;
    pipelineId?: string;
    statementIds?: string[];
  } = {}
): Promise<Map<string, number>> {
  const { kedroBaseUrl, pipelineId, statementIds } = options;

  if (!conn) {
    await initializeDuckDB();
  }

  try {
    // Ensure votes table is loaded
    await ensureVotesTableLoaded(kedroBaseUrl, pipelineId);

    // Build WHERE clause conditions
    const conditions = ['vote IS NOT NULL'];

    // Add statement ID filter if provided
    if (statementIds && statementIds.length > 0) {
      const statementIdList = statementIds.map(id => `'${id}'`).join(',');
      conditions.push(`comment_id IN (${statementIdList})`);
    }

    const whereClause = conditions.join(' AND ');

    // Query to get vote counts per participant
    const result = await conn!.query(`
      SELECT
        participant_id,
        COUNT(*) as vote_count
      FROM votes
      WHERE ${whereClause}
      GROUP BY participant_id
    `);

    const voteCounts = new Map<string, number>();
    let maxVoteCount = 0;

    // First pass: collect all vote counts and find the maximum
    for (let i = 0; i < result.numRows; i++) {
      const participantId = result.getChild('participant_id')?.get(i)?.toString();
      const rawVoteCount = result.getChild('vote_count')?.get(i);

      // Convert BigInt to number if needed
      const voteCount = typeof rawVoteCount === 'bigint' ? Number(rawVoteCount) : rawVoteCount as number;

      if (participantId !== undefined && voteCount !== undefined) {
        voteCounts.set(participantId, voteCount);
        maxVoteCount = Math.max(maxVoteCount, voteCount);
      }
    }

    // Second pass: normalize vote counts to 0-1 range
    const normalizedVoteCounts = new Map<string, number>();
    if (maxVoteCount > 0) {
      voteCounts.forEach((count, participantId) => {
        normalizedVoteCounts.set(participantId, count / maxVoteCount);
      });
    }

    const filterInfo = statementIds ? `${statementIds.length} statements` : 'all statements';
    console.log(`Calculated vote counts for ${normalizedVoteCounts.size} participants (max: ${maxVoteCount}) from ${filterInfo}`);
    return normalizedVoteCounts;
  } catch (error) {
    console.error('Failed to get vote counts:', error);
    // Return empty map instead of throwing in development
    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.warn('Returning empty vote counts map due to error in development environment');
      return new Map<string, number>();
    }
    throw error;
  }
}

/**
 * Helper function to filter non-moderated statement IDs from statements array
 * @param statements - Array of statement objects with statement_id and moderated fields
 * @returns Array of statement IDs where moderated !== -1
 */
export function getNonModeratedStatementIds(statements: Array<{ statement_id: string | number; moderated: number }>): string[] {
  return statements
    .filter(statement => statement.moderated !== -1)
    .map(statement => String(statement.statement_id));
}

/**
 * Load votes data from in-memory rows into DuckDB.
 * Used when votes come from an h5ad file rather than a parquet URL.
 * Creates the votes table with the same schema as the parquet-loaded version.
 */
export async function loadVotesFromMemory(
  votesRows: { participant_id: string; comment_id: string; vote: number }[]
): Promise<void> {
  if (!conn) {
    await initializeDuckDB();
  }

  try {
    // Create the votes table
    await conn!.query(`
      CREATE OR REPLACE TABLE votes (
        participant_id VARCHAR,
        comment_id VARCHAR,
        vote INTEGER
      )
    `);

    // Insert in batches of 1000
    const BATCH_SIZE = 1000;
    for (let i = 0; i < votesRows.length; i += BATCH_SIZE) {
      const batch = votesRows.slice(i, i + BATCH_SIZE);
      const values = batch
        .map(r => `('${r.participant_id}', '${r.comment_id}', ${r.vote})`)
        .join(',');
      await conn!.query(`INSERT INTO votes VALUES ${values}`);
    }

    votesTableLoaded = true;
    lastVotesConfig = 'memory';
    console.log(`✅ Loaded ${votesRows.length} vote rows from memory into DuckDB`);
  } catch (error) {
    console.error('Failed to load votes from memory:', error);
    throw new Error('Failed to load votes data from memory');
  }
}

/**
 * Close DuckDB connection and cleanup
 */
export async function closeDuckDB(): Promise<void> {
  try {
    if (conn) {
      await conn.close();
      conn = null;
    }
    if (db) {
      await db.terminate();
      db = null;
    }
    // Reset votes table tracking
    votesTableLoaded = false;
    lastVotesConfig = null;
    console.log('DuckDB connection closed');
  } catch (error) {
    console.error('Error closing DuckDB:', error);
  }
}
