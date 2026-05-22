import { parquetReadObjects, parquetMetadata } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

export type VoteRow = { participant_id: string; comment_id: string; vote: number };

/**
 * Fetch and parse a votes Parquet file from a URL.
 * Handles column naming conventions from valency-anndata and Kedro:
 * voter-id / voter_id / participant_id and comment-id / comment_id.
 */
export async function readVoteParquet(url: string): Promise<VoteRow[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch votes parquet from ${url}: ${response.status} ${response.statusText}`);
  }
  const file = await response.arrayBuffer();
  const metadata = parquetMetadata(file);
  const columnNames = (metadata.schema as { name: string }[])
    .slice(1) // first entry is the root schema node
    .map(s => s.name);

  const participantKey = findKey(columnNames, ['voter-id', 'voter_id', 'participant_id', 'participant-id']);
  const commentKey = findKey(columnNames, ['comment-id', 'comment_id', 'statement_id', 'statement-id']);
  const voteKey = findKey(columnNames, ['vote', 'votes']);

  if (!participantKey || !commentKey || !voteKey) {
    throw new Error(`Votes parquet missing required columns. Found: ${columnNames.join(', ')}`);
  }

  const rawRows = await parquetReadObjects({
    file,
    compressors,
    columns: [participantKey, commentKey, voteKey],
  }) as Record<string, unknown>[];

  return rawRows.map(row => ({
    participant_id: String(row[participantKey]),
    comment_id: String(row[commentKey]),
    vote: typeof row[voteKey] === 'bigint' ? Number(row[voteKey]) : Number(row[voteKey]),
  }));
}

function findKey(available: string[], candidates: string[]): string | undefined {
  return candidates.find(k => available.includes(k));
}
