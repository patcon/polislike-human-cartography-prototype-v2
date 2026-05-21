/**
 * App-layer adapter: wires the reddwarf-ts package to DuckDB and exposes
 * the same public API that app components depend on.
 */

import {
  calculateRepresentativeStatements as _calculateRepresentativeStatements,
  getLabelArrayWithOptionalUngrouped,
  hasEnoughGroupsForAnalysis,
  getAnalysisStatusMessage,
  formatRepresentativeStatementsForDisplay,
  createStatementTextMap,
  RepresentativeStatementsManager as _RepresentativeStatementsManager,
} from 'reddwarf-ts';
import { UNPAINTED_VALUE } from '@/constants';
import type {
  FinalizedCommentStats,
  ConsensusStatement,
  GroupVoteMatrix,
  AnalysisOptions as PackageAnalysisOptions,
  RepresentativeStatementsResult,
} from 'reddwarf-ts';

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

export interface AnalysisOptions extends PackageAnalysisOptions {
  kedroBaseUrl?: string;
  pipelineId?: string;
}

/**
 * Calculate representative statements for the app.
 * Handles DuckDB connection and votes-table loading before delegating to the package.
 */
export async function calculateRepresentativeStatements(
  labelArray: (string | null)[],
  participants: string[],
  commentTextMap: Record<string | number, unknown>,
  options: AnalysisOptions = {}
): Promise<RepresentativeStatementsResult> {
  const {
    kedroBaseUrl,
    pipelineId,
    ...packageOptions
  } = options;

  const { ensureVotesTableLoaded, getConnection } = await import('@/lib/duckdb');
  await ensureVotesTableLoaded(kedroBaseUrl, pipelineId);

  const conn = getConnection();
  if (!conn) {
    throw new Error('Database connection not available');
  }

  return _calculateRepresentativeStatements(conn, labelArray, participants, { ...packageOptions, commentTextMap });
}

/**
 * App-level manager: adds DuckDB connection injection on top of the package manager.
 */
export class RepresentativeStatementsManager {
  private _manager = new _RepresentativeStatementsManager();

  get isCalculating(): boolean {
    return this._manager.isCalculating;
  }

  get lastResult(): RepresentativeStatementsResult | null {
    return this._manager.lastResult;
  }

  get error(): Error | null {
    return this._manager.error;
  }

  async calculate(
    labelArray: (string | null)[],
    participants: string[],
    commentTextMap: Record<string | number, unknown>,
    options: AnalysisOptions = {}
  ): Promise<RepresentativeStatementsResult> {
    const { kedroBaseUrl, pipelineId, ...packageOptions } = options;

    const { ensureVotesTableLoaded, getConnection } = await import('@/lib/duckdb');
    await ensureVotesTableLoaded(kedroBaseUrl, pipelineId);

    const conn = getConnection();
    if (!conn) {
      throw new Error('Database connection not available');
    }

    return this._manager.calculate(conn, labelArray, participants, { ...packageOptions, commentTextMap });
  }

  reset(): void {
    this._manager.reset();
  }
}
