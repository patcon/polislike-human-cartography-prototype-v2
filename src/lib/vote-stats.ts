import { getAnnDataStore } from './anndata-store';

export type VoteStats = {
  agree: number;
  disagree: number;
  pass: number;
  total: number;
};

export type StatementVoteStats = Record<number, VoteStats>; // groupIndex -> stats

/**
 * Calculate vote statistics for a statement across all groups
 */
export function calculateStatementVoteStats(
  statementId: number,
  dataset: [string, [number, number]][],
  pointGroups: number[],
  activeColors: number[],
): StatementVoteStats {
  try {
    const store = getAnnDataStore();
    const participantIds = dataset.map(([id]) => id);
    const votes = store
      ? store.getVotesForStatement(statementId.toString(), participantIds)
      : new Map<string, number>();

    // Initialize stats for each active group
    const stats: StatementVoteStats = {};
    activeColors.forEach(groupIndex => {
      stats[groupIndex] = {
        agree: 0,
        disagree: 0,
        pass: 0,
        total: 0
      };
    });

    // Count votes for each group
    dataset.forEach(([participantId], index) => {
      const groupIndex = pointGroups[index];

      // Only count if this group is active
      if (!activeColors.includes(groupIndex)) {
        return;
      }

      const vote = votes.get(participantId);

      if (vote !== undefined) {
        const groupStats = stats[groupIndex];

        switch (vote) {
          case 1:
            groupStats.agree++;
            break;
          case -1:
            groupStats.disagree++;
            break;
          case 0:
            groupStats.pass++;
            break;
        }

        groupStats.total++;
      }
    });

    return stats;
  } catch (error) {
    console.error(`Error calculating vote stats for statement ${statementId}:`, error);
    const emptyStats: StatementVoteStats = {};
    activeColors.forEach(groupIndex => {
      emptyStats[groupIndex] = { agree: 0, disagree: 0, pass: 0, total: 0 };
    });
    return emptyStats;
  }
}

/**
 * Format vote stats for display
 */
export function formatVoteStats(stats: VoteStats): string {
  return `Agree: ${stats.agree}, Disagree: ${stats.disagree}, Pass: ${stats.pass}, Total: ${stats.total}`;
}