/**
 * Orchestration functions for representative statement analysis.
 * Works with any labeled grouping of participants (k-means, HDBSCAN, manual, etc.).
 */

import {
  calculateRepresentativeComments,
  selectConsensusStatements,
} from './stats.js';
import type {
  FinalizedCommentStats,
  ConsensusStatement,
  GroupVoteMatrix,
} from './stats.js';
import { getGroupVoteMatrices } from './db.js';
import type { VoteConnection } from './db.js';

// Re-export types so consumers only need one import
export type {
  FinalizedCommentStats,
  ConsensusStatement,
  GroupVoteMatrix,
  VoteConnection,
};

/** Sentinel value indicating a participant has no group assignment. */
export const UNGROUPED_VALUE = -1;

export interface RepresentativeStatementsResult {
  repComments: Record<string, FinalizedCommentStats[]>;
  consensusStatements: { agree: ConsensusStatement[]; disagree: ConsensusStatement[] } | null;
  groupVotes: Record<string, GroupVoteMatrix>;
}

export interface AnalysisOptions {
  includeModerated?: boolean;
  minVoteCount?: number;
  maxStatementsCount?: number;
  commentTextMap?: Record<string | number, unknown>;
}

/**
 * Fetch votes from the DB, then compute representative and consensus statements.
 * The caller must ensure the votes table is loaded in `conn` before calling.
 */
export async function calculateRepresentativeStatements(
  conn: VoteConnection,
  labelArray: (string | null)[],
  participants: string[],
  options: AnalysisOptions = {}
): Promise<RepresentativeStatementsResult> {
  const {
    includeModerated = false,
    minVoteCount = 1,
    maxStatementsCount = 10,
    commentTextMap = {},
  } = options;

  const groupVotes = await getGroupVoteMatrices(conn, labelArray, participants);
  const repComments = calculateRepresentativeComments(groupVotes, undefined, {
    includeModerated,
    minVoteCount,
    maxStatementsCount,
    commentTextMap,
  });

  let consensusStatements = null;
  if (Object.keys(groupVotes).length >= 2) {
    const modOutStatementIds: number[] = [];
    if (!includeModerated) {
      Object.entries(commentTextMap).forEach(([tid, comment]) => {
        const c = comment as { mod?: string | number } | null;
        if (c?.mod === "-1" || c?.mod === -1) {
          modOutStatementIds.push(parseInt(tid));
        }
      });
    }
    consensusStatements = selectConsensusStatements(groupVotes, modOutStatementIds, null, 0.5, {
      minVoteCount,
      maxStatementsCount,
    });
  }

  return { repComments, consensusStatements, groupVotes };
}

/**
 * Create a statement text map from an array of statements.
 */
export function createStatementTextMap(
  statements: Array<{ statement_id: number; txt: string }>
): Record<string | number, string> {
  const map: Record<string | number, string> = {};

  statements.forEach(statement => {
    map[statement.statement_id] = statement.txt;
    map[statement.statement_id.toString()] = statement.txt;
  });

  return map;
}

/**
 * Convert a color-index array to a label array, optionally including ungrouped participants.
 *
 * @param colorByIndex - Numeric group index per participant (UNGROUPED_VALUE = no group)
 * @param includeUngrouped - If true, ungrouped participants form their own group
 * @param displayMask - Optional boolean mask; false entries are excluded from analysis
 */
export function getLabelArrayWithOptionalUngrouped(
  colorByIndex: number[],
  includeUngrouped: boolean = false,
  displayMask?: boolean[]
): (string | null)[] {
  const labels: (string | null)[] = [];

  for (let i = 0; i < colorByIndex.length; i++) {
    if (displayMask && !displayMask[i]) {
      labels.push(null);
      continue;
    }
    const colorIndex = colorByIndex[i];
    if (colorIndex === UNGROUPED_VALUE && !includeUngrouped) {
      labels.push(null);
    } else {
      labels.push(colorIndex.toString());
    }
  }

  return labels;
}

/**
 * Check whether the label array contains at least two distinct groups.
 */
export function hasEnoughGroupsForAnalysis(labelArray: (string | null)[]): boolean {
  const uniqueLabels = new Set(labelArray.filter(label => label !== null));
  return uniqueLabels.size >= 2;
}

/**
 * Return a human-readable status message for the current label array.
 */
export function getAnalysisStatusMessage(labelArray: (string | null)[]): string {
  const uniqueLabels = new Set(labelArray.filter(label => label !== null));
  const groupCount = uniqueLabels.size;

  if (groupCount === 0) {
    return "No groups defined. Create at least two groups to analyze representative statements.";
  } else if (groupCount === 1) {
    return "Only one group defined. Create at least two groups to analyze representative statements.";
  } else {
    return `${groupCount} groups available for analysis.`;
  }
}

/**
 * Format representative statements for display, pairing each with its text.
 */
export function formatRepresentativeStatementsForDisplay(
  repComments: Record<string, FinalizedCommentStats[]>,
  statementTextMap: Record<string | number, string>
): Record<string, Array<{
  tid: string | number;
  txt: string;
  stats: FinalizedCommentStats;
}>> {
  const formatted: Record<string, Array<{
    tid: string | number;
    txt: string;
    stats: FinalizedCommentStats;
  }>> = {};

  Object.entries(repComments).forEach(([groupId, statements]) => {
    formatted[groupId] = statements.map(stat => ({
      tid: stat.tid,
      txt: statementTextMap[stat.tid] || `Statement ${stat.tid}`,
      stats: stat
    }));
  });

  return formatted;
}

/**
 * Stateful manager for representative statement calculations.
 */
export class RepresentativeStatementsManager {
  private _isCalculating = false;
  private _lastResult: RepresentativeStatementsResult | null = null;
  private _error: Error | null = null;

  get isCalculating(): boolean {
    return this._isCalculating;
  }

  get lastResult(): RepresentativeStatementsResult | null {
    return this._lastResult;
  }

  get error(): Error | null {
    return this._error;
  }

  async calculate(
    conn: VoteConnection,
    labelArray: (string | null)[],
    participants: string[],
    options: AnalysisOptions = {}
  ): Promise<RepresentativeStatementsResult> {
    if (this._isCalculating) {
      throw new Error('Calculation already in progress');
    }

    this._isCalculating = true;
    this._error = null;

    try {
      const result = await calculateRepresentativeStatements(conn, labelArray, participants, options);
      this._lastResult = result;
      return result;
    } catch (error) {
      this._error = error as Error;
      throw error;
    } finally {
      this._isCalculating = false;
    }
  }

  reset(): void {
    this._isCalculating = false;
    this._lastResult = null;
    this._error = null;
  }
}
