import type { GroupVoteMatrix } from './stats.js';

export type { GroupVoteMatrix };

/**
 * Build per-group vote matrices from a pre-built lookup function.
 * Replaces the former DuckDB-based SQL implementation.
 *
 * @param getVotesForParticipants - Function that returns votes for a list of participant IDs.
 *   Keys are participant IDs; values are objects mapping statement ID → vote (-1/0/1).
 * @param labelArray - Parallel to `participants`; null means "exclude from analysis".
 * @param participants - Participant ID at each index.
 */
export function getGroupVoteMatrices(
  getVotesForParticipants: (participantIds: string[]) => GroupVoteMatrix,
  labelArray: (string | null)[],
  participants?: string[],
): Record<string, GroupVoteMatrix> {
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
  for (const [label, pids] of Object.entries(groups)) {
    groupVotes[label] = getVotesForParticipants(pids);
  }
  return groupVotes;
}
