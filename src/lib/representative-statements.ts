/**
 * App-layer adapter: wires the reddwarf-ts package to the AnnDataStore and
 * exposes the same public API that app components depend on.
 */

import {
  calculateRepresentativeStatements as _calculateRepresentativeStatements,
  getLabelArrayWithOptionalUngrouped,
  hasEnoughGroupsForAnalysis,
  getAnalysisStatusMessage,
  formatRepresentativeStatementsForDisplay,
  createStatementTextMap,
} from 'reddwarf-ts';
import { UNPAINTED_VALUE } from '@/constants';
import type {
  FinalizedCommentStats,
  ConsensusStatement,
  GroupVoteMatrix,
  AnalysisOptions as PackageAnalysisOptions,
  RepresentativeStatementsResult,
} from 'reddwarf-ts';
import { getAnnDataStore } from '@/lib/anndata-store';

// Re-export types and pure helpers for app consumers
export type { FinalizedCommentStats, ConsensusStatement, GroupVoteMatrix, RepresentativeStatementsResult };
export {
  getLabelArrayWithOptionalUngrouped,
  hasEnoughGroupsForAnalysis,
  getAnalysisStatusMessage,
  formatRepresentativeStatementsForDisplay,
  createStatementTextMap,
};

// Verify UNPAINTED_VALUE and UNGROUPED_VALUE stay in sync
// (UNGROUPED_VALUE = -1 in the package; UNPAINTED_VALUE = -1 in the app)
export { UNPAINTED_VALUE };

export type AnalysisOptions = PackageAnalysisOptions;

/**
 * Calculate representative statements using the in-memory AnnDataStore.
 */
export function calculateRepresentativeStatements(
  labelArray: (string | null)[],
  participants: string[],
  commentTextMap: Record<string | number, unknown>,
  options: AnalysisOptions = {}
): RepresentativeStatementsResult {
  const store = getAnnDataStore();
  if (!store) {
    throw new Error('AnnDataStore not initialised — load data before calculating representative statements');
  }

  const groupVotes = store.getGroupVoteMatrices(labelArray, participants);
  return _calculateRepresentativeStatements(groupVotes, { ...options, commentTextMap });
}
