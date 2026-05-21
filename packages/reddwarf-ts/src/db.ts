import type { GroupVoteMatrix } from './stats.js';

/**
 * Minimal structural interface for a DuckDB-WASM query result.
 * Any object satisfying this shape can be passed to the DB-dependent functions.
 */
export interface VoteQueryResult {
  numRows: number;
  getChild(name: string): { get(i: number): unknown } | null | undefined;
}

export interface VoteConnection {
  query(sql: string): Promise<VoteQueryResult>;
}

/**
 * Query votes for each label group from a DuckDB-compatible connection.
 * The caller is responsible for ensuring the votes table is loaded before calling this.
 */
export async function getGroupVoteMatrices(
  conn: VoteConnection,
  labelArray: (string | null)[],
  participants?: string[],
): Promise<Record<string, GroupVoteMatrix>> {
  const groups: Record<string, string[]> = {};
  labelArray.forEach((label, index) => {
    if (label != null) {
      const pid = participants?.[index];
      if (pid !== undefined) {
        if (!groups[label]) groups[label] = [];
        groups[label].push(pid);
      }
    }
  });

  const groupVotes: Record<string, GroupVoteMatrix> = {};
  for (const [label, indices] of Object.entries(groups)) {
    const quotedIndices = indices.map((pid) => `'${pid}'`);
    const result = await conn.query(`
      SELECT participant_id, comment_id, vote
      FROM votes
      WHERE participant_id IN(${quotedIndices.join(",")})
    `);

    const voteMatrix: GroupVoteMatrix = {};
    for (let i = 0; i < result.numRows; i++) {
      const pid = result.getChild('participant_id')?.get(i)?.toString();
      const cid = result.getChild('comment_id')?.get(i)?.toString();
      const rawVote = result.getChild('vote')?.get(i);

      const vote = typeof rawVote === 'bigint' ? Number(rawVote) : rawVote as number;

      if (pid && cid && vote !== undefined) {
        if (!voteMatrix[pid]) voteMatrix[pid] = {};
        voteMatrix[pid][cid] = vote;
      }
    }

    groupVotes[label] = voteMatrix;
  }

  return groupVotes;
}
