/**
 * Integration functions for connecting representative statement calculations
 * with React components
 */

import { analyzePaintedClusters } from '@/lib/stats';
import { UNPAINTED_VALUE } from '@/constants';
import type {
  FinalizedCommentStats,
  ConsensusStatement,
  GroupVoteMatrix
} from '@/lib/stats';

export interface RepresentativeStatementsResult {
  repComments: Record<string, FinalizedCommentStats[]>;
  consensusStatements: { agree: ConsensusStatement[]; disagree: ConsensusStatement[] } | null;
  groupVotes: Record<string, GroupVoteMatrix>;
}

export interface AnalysisOptions {
  includeModerated?: boolean;
  minVoteCount?: number;
  maxStatementsCount?: number;
  kedroBaseUrl?: string;
  pipelineId?: string;
}

/**
 * Calculate representative statements for painted groups
 * @param labelArray - Array of group labels for each participant
 * @param participants - Array of participant IDs
 * @param commentTextMap - Map of comment IDs to comment text
 * @param options - Analysis options
 * @returns Promise with representative statements results
 */
export async function calculateRepresentativeStatements(
  labelArray: (string | null)[],
  participants: string[],
  commentTextMap: Record<string | number, string>,
  options: AnalysisOptions = {}
): Promise<RepresentativeStatementsResult> {
  const {
    includeModerated = false,
    minVoteCount = 1,
    maxStatementsCount = 10,
    kedroBaseUrl,
    pipelineId
  } = options;

  console.log('🔍 calculateRepresentativeStatements: Passing config:', { kedroBaseUrl, pipelineId });

  try {
    const result = await analyzePaintedClusters(
      labelArray,
      undefined, // commentTexts - we'll use the map instead
      participants,
      {
        includeModerated,
        minVoteCount,
        maxStatementsCount,
        commentTextMap,
        kedroBaseUrl,
        pipelineId
      }
    );

    return result;
  } catch (error) {
    console.error('Error calculating representative statements:', error);
    throw error;
  }
}

/**
 * Create a statement text map from an array of statements
 * @param statements - Array of statement objects
 * @returns Map of statement IDs to text
 */
export function createStatementTextMap(
  statements: Array<{ statement_id: number; txt: string }>
): Record<string | number, string> {
  const map: Record<string | number, string> = {};

  statements.forEach(statement => {
    map[statement.statement_id] = statement.txt;
    map[statement.statement_id.toString()] = statement.txt; // Also store string version
  });

  return map;
}

/**
 * Get label array with optional ungrouped points
 * @param colorByIndex - Array of color indices for each participant
 * @param includeUnpainted - Whether to include unpainted points as a group
 * @returns Label array
 */
export function getLabelArrayWithOptionalUngrouped(
  colorByIndex: number[],
  includeUnpainted: boolean = false,
  displayMask?: boolean[]
): (string | null)[] {
  const labels: (string | null)[] = [];

  for (let i = 0; i < colorByIndex.length; i++) {
    // Exclude masked participants from analysis
    if (displayMask && !displayMask[i]) {
      labels.push(null);
      continue;
    }
    const colorIndex = colorByIndex[i];
    // Include unpainted points as a group if requested, otherwise exclude them
    if (colorIndex === UNPAINTED_VALUE && !includeUnpainted) {
      labels.push(null); // Exclude from analysis
    } else {
      labels.push(colorIndex.toString()); // Include all groups (including unpainted if requested)
    }
  }

  return labels;
}

/**
 * Check if we have enough groups for analysis
 * @param labelArray - Array of labels
 * @returns True if we have at least 2 groups
 */
export function hasEnoughGroupsForAnalysis(labelArray: (string | null)[]): boolean {
  const uniqueLabels = new Set(labelArray.filter(label => label !== null));
  return uniqueLabels.size >= 2;
}

/**
 * Get analysis status message
 * @param labelArray - Array of labels
 * @returns Status message for UI display
 */
export function getAnalysisStatusMessage(labelArray: (string | null)[]): string {
  const uniqueLabels = new Set(labelArray.filter(label => label !== null));
  const groupCount = uniqueLabels.size;

  if (groupCount === 0) {
    return "No groups painted. Paint at least two groups to analyze representative statements.";
  } else if (groupCount === 1) {
    return "Only one group painted. Paint at least two groups to analyze representative statements.";
  } else {
    return `${groupCount} groups available for analysis.`;
  }
}

/**
 * Format representative statements for display
 * @param repComments - Representative comments by group
 * @param statementTextMap - Map of statement IDs to text
 * @returns Formatted representative statements
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
 * Hook-like function to manage representative statements state
 * This can be used in React components to manage the calculation and state
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
    labelArray: (string | null)[],
    participants: string[],
    commentTextMap: Record<string | number, string>,
    options: AnalysisOptions = {}
  ): Promise<RepresentativeStatementsResult> {
    if (this._isCalculating) {
      throw new Error('Calculation already in progress');
    }

    this._isCalculating = true;
    this._error = null;

    try {
      const result = await calculateRepresentativeStatements(
        labelArray,
        participants,
        commentTextMap,
        options
      );

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