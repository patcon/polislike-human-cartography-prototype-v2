import { getVotesForParticipants } from './duckdb';

export type DebugVoteStats = {
  agree: number;
  disagree: number;
  pass: number;
  total: number;
};

export type StatementDebugStats = Record<number, DebugVoteStats>; // groupIndex -> stats

/**
 * Calculate vote statistics for a statement across all groups
 */
export async function calculateStatementVoteStats(
  statementId: number,
  dataset: [string, [number, number]][],
  pointGroups: number[],
  activeColors: number[],
  kedroBaseUrl?: string,
  pipelineId?: string
): Promise<StatementDebugStats> {
  try {
    // Get all participant IDs from dataset
    const participantIds = dataset.map(([id]) => id);

    // Get votes for all participants for this statement
    const votes = await getVotesForParticipants(
      statementId.toString(),
      participantIds,
      kedroBaseUrl,
      pipelineId
    );

    // Initialize stats for each active group
    const stats: StatementDebugStats = {};
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
    // Return empty stats on error
    const emptyStats: StatementDebugStats = {};
    activeColors.forEach(groupIndex => {
      emptyStats[groupIndex] = {
        agree: 0,
        disagree: 0,
        pass: 0,
        total: 0
      };
    });
    return emptyStats;
  }
}

/**
 * Format debug vote stats for display
 */
export function formatDebugVoteStats(stats: DebugVoteStats): string {
  return `Agree: ${stats.agree}, Disagree: ${stats.disagree}, Pass: ${stats.pass}, Total: ${stats.total}`;
}