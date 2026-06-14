import { useState, useCallback } from 'react';
import {
  calculateRepresentativeStatements,
  createStatementTextMap,
  getLabelArrayWithOptionalUngrouped,
} from '@/lib/representative-statements';
import type { FinalizedCommentStats, ConsensusStatement } from '@/lib/stats';

export interface UseRepresentativeStatementsProps {
  statements: Record<string, unknown>[];
  dataset: [string, [number, number]][];
  pointGroups: number[];
  currentPipelineId: string;
  kedroBaseUrl?: string;
  isUnpaintedGrouped: boolean;
  drawerTab: string;
  setDrawerTab: (tab: string) => void;
}

export interface UseRepresentativeStatementsReturn {
  representativeStatements: Record<string, FinalizedCommentStats[]>;
  consensusStatements: { agree: ConsensusStatement[]; disagree: ConsensusStatement[] } | null;
  isCalculatingRepStatements: boolean;
  repStatementsError: string | null;
  calculateRepStatements: (updatedPointGroups?: number[], updatedIsUnpaintedGrouped?: boolean, mask?: boolean[]) => Promise<void>;
  clearRepStatements: () => void;
}

export function useRepresentativeStatements(props: UseRepresentativeStatementsProps): UseRepresentativeStatementsReturn {
  const {
    statements,
    dataset,
    pointGroups,
    currentPipelineId,
    kedroBaseUrl,
    isUnpaintedGrouped,
    drawerTab,
    setDrawerTab,
  } = props;

  const [representativeStatements, setRepresentativeStatements] = useState<Record<string, FinalizedCommentStats[]>>({});
  const [consensusStatements, setConsensusStatements] = useState<{ agree: ConsensusStatement[]; disagree: ConsensusStatement[] } | null>(null);
  const [isCalculatingRepStatements, setIsCalculatingRepStatements] = useState(false);
  const [repStatementsError, setRepStatementsError] = useState<string | null>(null);

  const clearRepStatements = useCallback(() => {
    setRepresentativeStatements({});
    setConsensusStatements(null);
    setRepStatementsError(null);
    if (drawerTab !== 'all') {
      setDrawerTab('all');
    }
  }, [drawerTab, setDrawerTab]);

  const calculateRepStatementsCallback = useCallback(async (
    updatedPointGroups?: number[],
    updatedIsUnpaintedGrouped?: boolean,
    mask?: boolean[]
  ) => {
    if (isCalculatingRepStatements) return;

    const groupsToAnalyze = updatedPointGroups || pointGroups;
    const unpaintedGroupedToUse = updatedIsUnpaintedGrouped !== undefined ? updatedIsUnpaintedGrouped : isUnpaintedGrouped;
    const statementTextMap = createStatementTextMap(statements);
    const labelArray = getLabelArrayWithOptionalUngrouped(groupsToAnalyze, unpaintedGroupedToUse, mask);
    const uniqueGroups = new Set(labelArray.filter(label => label !== null));
    const canAnalyze = uniqueGroups.size >= 2;

    if (!canAnalyze) {
      setRepresentativeStatements({});
      setConsensusStatements(null);
      setRepStatementsError(null);
      if (drawerTab !== 'all') {
        setDrawerTab('all');
      }
      return;
    }

    setIsCalculatingRepStatements(true);
    setRepStatementsError(null);

    try {
      const participants = dataset.map(([participantId]) => participantId);
      const result = await calculateRepresentativeStatements(
        labelArray,
        participants,
        statementTextMap,
        {
          includeModerated: false,
          minVoteCount: 1,
          maxStatementsCount: 10,
          kedroBaseUrl,
          pipelineId: currentPipelineId,
        }
      );
      setRepresentativeStatements(result.repComments);
      setConsensusStatements(result.consensusStatements);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate representative statements';
      setRepStatementsError(errorMessage);
    } finally {
      setIsCalculatingRepStatements(false);
    }
  }, [isCalculatingRepStatements, statements, pointGroups, dataset, drawerTab, setDrawerTab, isUnpaintedGrouped, kedroBaseUrl, currentPipelineId]);

  return {
    representativeStatements,
    consensusStatements,
    isCalculatingRepStatements,
    repStatementsError,
    calculateRepStatements: calculateRepStatementsCallback,
    clearRepStatements,
  };
}
