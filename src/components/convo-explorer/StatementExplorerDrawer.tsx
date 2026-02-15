// StatementExplorerDrawer.tsx
"use client";

import * as React from "react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { StatementTable } from "./StatementTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupTabsTrigger, type GroupTabsStyle } from "./GroupTabsTrigger";
import { StatementExplorerButton } from "./StatementExplorerButton";
import { PALETTE_COLORS, VOTE_COLORS, UNPAINTED_VALUE } from "@/constants";
import { X } from "lucide-react";
import type { FinalizedCommentStats, ConsensusStatement } from "@/lib/stats";
import { useGoogleTranslateRefresh } from "@/hooks/useGoogleTranslateRefresh";
import type { GroupVoteData } from "./GroupVoteComparisonWidget";
import { calculateStatementVoteStats, type StatementVoteStats } from "@/lib/vote-stats";

export type Statement = {
  statement_id: number;
  txt: string;
  moderated?: -1 | 0 | 1;
};

export type RepresentativeStatement = {
  tid: string | number;
  txt: string;
  n_agree: number;
  n_disagree: number;
  n_pass: number;
  n_success: number;
  n_trials: number;
  p_success: number;
  p_test: number;
  repness: number;
  repness_test: number;
  repful_for: string;
  best_agree?: boolean;
  moderated?: -1 | 0 | 1;
};

type StatementExplorerDrawerProps = {
  statements: Statement[];
  activeColors?: number[];
  representativeStatements?: Record<string, FinalizedCommentStats[]>;
  consensusStatements?: { agree: ConsensusStatement[]; disagree: ConsensusStatement[] } | null;
  isCalculatingRepStatements?: boolean;
  repStatementsError?: string | null;
  isUnpaintedGrouped?: boolean;
  pointGroups?: number[]; // Add pointGroups to check for unpainted participants
  /** Display mask parallel to pointGroups: true = visible, false = hidden. When undefined, all points counted. */
  displayMask?: boolean[];

  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;

  tabValue?: string;
  onTabValueChange?: (v: string) => void;
  defaultTab?: string;

  groupTabStyle?: GroupTabsStyle;

  onStatementClick?: (statementId: number) => void;

  // Debug mode props
  debugMode?: boolean;
  dataset?: [string, [number, number]][];

  // Kedro configuration props
  kedroBaseUrl?: string;
  pipelineId?: string;

  /** Whether WebAssembly is available (false when Lockdown Mode is active) */
  wasmSupported?: boolean;
};

export const StatementExplorerDrawer: React.FC<StatementExplorerDrawerProps> = ({
  statements,
  activeColors = [],
  representativeStatements = {},
  consensusStatements = null,
  isCalculatingRepStatements = false,
  repStatementsError = null,
  isUnpaintedGrouped = false,
  pointGroups = [],
  displayMask,

  open,
  onOpenChange,
  defaultOpen = false,

  tabValue,
  onTabValueChange,
  defaultTab = "all",

  groupTabStyle = "enclosure",

  onStatementClick,

  // Debug mode props
  debugMode = false,
  dataset = [],

  // Kedro configuration props
  kedroBaseUrl,
  pipelineId,

  wasmSupported = true,
}) => {
  const [internalOpen, setInternalOpen] = React.useState<boolean>(defaultOpen);
  const [internalTab, setInternalTab] = React.useState<string>(defaultTab);
  const [includeMissingVotes, setIncludeMissingVotes] = React.useState<boolean>(false);

  const isOpen = open ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  const activeTab = tabValue ?? internalTab;
  const handleTabChange = onTabValueChange ?? setInternalTab;

  const handleToggleMissingVotes = React.useCallback(() => {
    console.log('🔍 StatementExplorerDrawer: Toggling missing votes', {
      currentValue: includeMissingVotes,
      newValue: !includeMissingVotes
    });
    setIncludeMissingVotes(prev => {
      const newValue = !prev;
      console.log('🔍 StatementExplorerDrawer: State updated', {
        oldValue: prev,
        newValue
      });
      return newValue;
    });
  }, [includeMissingVotes]);

  // Vote stats state - managed locally in StatementExplorerDrawer
  // Only calculated for statements in group tabs and consensus tab, not for "All" tab
  const [voteStats, setVoteStats] = React.useState<Record<number, StatementVoteStats>>({});
  const [loadingVoteStats, setLoadingVoteStats] = React.useState<Set<number>>(new Set());

  // Calculate vote stats for specific statements when needed (lazy loading)
  // This is only used for group tabs (representative statements) and consensus tab
  const calculateVoteStatsForStatements = React.useCallback(async (statementIds: number[]): Promise<void> => {
    // Mark statements as loading
    setLoadingVoteStats(prev => new Set([...prev, ...statementIds]));

    try {
      // Get active colors (including unpainted if grouped)
      const filtered = pointGroups.filter((x): x is number => x !== UNPAINTED_VALUE);
      const unique = [...new Set(filtered)];
      const hasUnpainted = pointGroups.some(group => group === UNPAINTED_VALUE);
      const activeColors = hasUnpainted && isUnpaintedGrouped ? [...unique, UNPAINTED_VALUE] : unique;

      // Only calculate if we have the necessary data
      if (!dataset.length || !pointGroups.length || activeColors.length === 0) {
        return;
      }

      const newStats: Record<number, StatementVoteStats> = {};

      // Calculate stats only for requested statements
      for (const statementId of statementIds) {
        try {
          const stats = await calculateStatementVoteStats(
            statementId,
            dataset,
            pointGroups,
            activeColors,
            kedroBaseUrl,
            pipelineId
          );
          newStats[statementId] = stats;
        } catch (error) {
          console.error(`Failed to load vote stats for statement ${statementId}:`, error);
        }
      }

      // Update vote stats state
      setVoteStats(prev => ({ ...prev, ...newStats }));
    } finally {
      // Remove statements from loading state
      setLoadingVoteStats(prev => {
        const next = new Set(prev);
        statementIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [dataset, pointGroups, isUnpaintedGrouped]);

  // Clear vote stats when groups change (will be recalculated on demand)
  // Use a ref to track the previous state to avoid unnecessary clearing
  const prevPointGroupsRef = React.useRef<number[]>([]);
  const prevIsUnpaintedGroupedRef = React.useRef<boolean>(isUnpaintedGrouped);

  React.useEffect(() => {
    // Only clear vote stats if the groups have actually changed, not just on re-renders
    const groupsChanged = JSON.stringify(pointGroups) !== JSON.stringify(prevPointGroupsRef.current);
    const unpaintedGroupedChanged = isUnpaintedGrouped !== prevIsUnpaintedGroupedRef.current;

    if (groupsChanged || unpaintedGroupedChanged) {
      console.log('🔍 StatementExplorerDrawer: Clearing vote stats due to group changes', {
        groupsChanged,
        unpaintedGroupedChanged,
        prevGroups: prevPointGroupsRef.current.length,
        newGroups: pointGroups.length
      });
      setVoteStats({});
    }

    // Update refs for next comparison
    prevPointGroupsRef.current = [...pointGroups];
    prevIsUnpaintedGroupedRef.current = isUnpaintedGrouped;
  }, [pointGroups, isUnpaintedGrouped]);

  // Debug logging for state
  React.useEffect(() => {
    console.log('🔍 StatementExplorerDrawer: includeMissingVotes state changed to:', includeMissingVotes);
  }, [includeMissingVotes]);

  // Trigger Google Translate re-scan when drawer opens or tab changes
  useGoogleTranslateRefresh([isOpen, activeTab]);

  const letterForIndex = (index: number) => {
    if (index === UNPAINTED_VALUE) return "X"; // Special case for unpainted
    return String.fromCharCode(65 + index);
  };
  // Just the painted colors (excluding unpainted), sorted
  const paintedColors = React.useMemo(() =>
    [...activeColors].filter(color => color !== UNPAINTED_VALUE).sort((a, b) => a - b),
    [activeColors]
  );

  // Calculate group member counts from pointGroups (shared with convertVoteStatsToGroupVoteData)
  const groupMemberCounts = React.useMemo(() => {
    const counts: Record<number, number> = {};
    pointGroups.forEach((group, i) => {
      if (displayMask && !displayMask[i]) return;
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [pointGroups, displayMask]);

  // Check if unpainted group should be shown as a tab
  const hasUnpaintedGroup = React.useMemo(() => {
    return activeColors.includes(UNPAINTED_VALUE) && isUnpaintedGrouped;
  }, [activeColors, isUnpaintedGrouped]);

  // All groups with painted colors first, then unpainted at the end (only if grouped)
  const sortedColors = React.useMemo(() => {
    const result = [...paintedColors];
    if (hasUnpaintedGroup) {
      result.push(UNPAINTED_VALUE);
    }
    return result;
  }, [paintedColors, hasUnpaintedGroup]);

  // Create statement text map from statements
  const statementTextMap = React.useMemo(() => {
    const map: Record<string | number, string> = {};
    statements.forEach(statement => {
      map[statement.statement_id] = statement.txt;
      map[statement.statement_id.toString()] = statement.txt;
    });
    return map;
  }, [statements]);

  // Convert representative statements to Statement format for display
  const convertRepStatementsToStatements = (repStats: FinalizedCommentStats[]): Statement[] => {
    return repStats.map((repStat) => ({
      statement_id: typeof repStat.tid === 'string' ? parseInt(repStat.tid) : repStat.tid,
      txt: statementTextMap[repStat.tid] || `Statement ${repStat.tid}`,
      moderated: undefined, // We'll handle moderation separately if needed
    }));
  };

  // Get representative statements for a specific color group
  const getRepresentativeStatementsForGroup = (colorIndex: number): Statement[] => {
    const groupKey = String(colorIndex); // Convert to string to match the key format
    const repStats = representativeStatements[groupKey] || [];
    return convertRepStatementsToStatements(repStats);
  };

  // Generate statement colors based on repful_for property
  const getStatementColors = (colorIndex: number): Record<number, string> => {
    const groupKey = String(colorIndex);
    const repStats = representativeStatements[groupKey] || [];
    const colors: Record<number, string> = {};

    repStats.forEach((repStat) => {
      const statementId = typeof repStat.tid === 'string' ? parseInt(repStat.tid) : repStat.tid;
      if (repStat.repful_for === 'agree') {
        colors[statementId] = VOTE_COLORS.agree;
      } else if (repStat.repful_for === 'disagree') {
        colors[statementId] = VOTE_COLORS.disagree;
      }
    });

    return colors;
  };


  // Convert consensus statements to Statement format for display
  const convertConsensusStatementsToStatements = (): { agree: Statement[]; disagree: Statement[] } => {
    if (!consensusStatements) {
      return { agree: [], disagree: [] };
    }

    const convertGroup = (statements: ConsensusStatement[]): Statement[] => {
      return statements.map((consStat) => ({
        statement_id: consStat.tid,
        txt: statementTextMap[consStat.tid] || `Statement ${consStat.tid}`,
        moderated: undefined,
      }));
    };

    return {
      agree: convertGroup(consensusStatements.agree),
      disagree: convertGroup(consensusStatements.disagree),
    };
  };

  // Generate statement colors for consensus statements
  const getConsensusStatementColors = (): Record<number, string> => {
    if (!consensusStatements) return {};

    const colors: Record<number, string> = {};

    consensusStatements.agree.forEach((consStat) => {
      colors[consStat.tid] = VOTE_COLORS.agree;
    });

    consensusStatements.disagree.forEach((consStat) => {
      colors[consStat.tid] = VOTE_COLORS.disagree;
    });

    return colors;
  };

  // Convert vote stats to GroupVoteData format for widgets (only when needed)
  const convertVoteStatsToGroupVoteData = React.useCallback((statsData: Record<number, StatementVoteStats>): Record<number, GroupVoteData[]> => {
    const groupVoteData: Record<number, GroupVoteData[]> = {};

    if (!statsData || !dataset.length || !pointGroups.length || sortedColors.length < 2) {
      return groupVoteData;
    }

    // For each statement, convert vote stats to GroupVoteData format
    Object.entries(statsData).forEach(([statementIdStr, stats]) => {
      const statementId = parseInt(statementIdStr);

      // Convert stats to GroupVoteData format
      const groupVotes: GroupVoteData[] = [];
      sortedColors.forEach(groupIndex => {
        const groupStats = stats[groupIndex];
        if (groupStats && typeof groupStats === 'object') {
          groupVotes.push({
            groupIndex,
            n_agree: groupStats.agree,
            n_disagree: groupStats.disagree,
            n_pass: groupStats.pass,
            n_trials: groupStats.total,
            totalGroupSize: groupMemberCounts[groupIndex],
          });
        }
      });

      // Add if we have data for multiple groups (for comparison)
      if (groupVotes.length > 1) {
        groupVoteData[statementId] = groupVotes;
      }
    });

    return groupVoteData;
  }, [dataset, pointGroups, sortedColors, groupMemberCounts]);

  // Generate group vote data from vote stats (only when vote stats are available)
  const groupVoteData = React.useMemo(() => {
    return convertVoteStatsToGroupVoteData(voteStats);
  }, [convertVoteStatsToGroupVoteData, voteStats]);

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} defaultOpen={defaultOpen}>
      <DrawerTrigger asChild>
        <StatementExplorerButton iconVariant="telescope" label="Explore Statements" />
      </DrawerTrigger>

        <DrawerContent className="w-full max-w-full flex flex-col h-full">
          <DrawerHeader className="relative">
            <DrawerTitle>Explore Statements</DrawerTitle>
            <DrawerClose asChild>
              <button
                aria-label="Close"
                className="absolute top-3 right-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto flex flex-col">
            {!wasmSupported && (
              <div className="mx-4 mb-2 rounded-md bg-amber-100 border border-amber-300 px-3 py-2 text-sm text-amber-900">
                Some features unavailable — check both browser and device Lockdown Mode.
              </div>
            )}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              {/* Sticky tabs container */}
              <div className="sticky top-0 z-10 bg-white shadow-md">
                <div className="px-4 pb-2">
                  {/* Single TabsList with two-row layout for accessibility */}
                  <TabsList
                    className="grid w-full h-auto p-1"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(sortedColors.length + 1, 2)}, 1fr)`,
                      gridTemplateRows: 'auto auto'
                    }}
                  >
                    {/* First row: Letter groups and Rest tab */}
                    {(() => {
                      const totalFirstRowTabs = sortedColors.length;
                      const totalColumns = Math.max(totalFirstRowTabs + 1, 2); // +1 for the empty column
                      const shouldSpanConsensusWidth = totalFirstRowTabs === 1;

                      return (
                        <>
                          {sortedColors.map((colorIndex, index) => {
                            const memberCount = groupMemberCounts[colorIndex] || 0;
                            return (
                              <GroupTabsTrigger
                                key={colorIndex}
                                value={`group-${colorIndex}`}
                                tabStyle={groupTabStyle}
                                color={colorIndex === UNPAINTED_VALUE ? "black" : PALETTE_COLORS[colorIndex]}
                                style={{
                                  gridRow: 1,
                                  gridColumn: shouldSpanConsensusWidth ? `2 / ${totalColumns + 1}` : index + 2
                                }}
                              >
                                {colorIndex === UNPAINTED_VALUE ? (
                                  <>
                                    <span translate="no" className="sm:hidden">X</span>
                                    <span className="hidden sm:inline">Rest</span>
                                    <span className="hidden md:inline text-xs ml-1 opacity-75">({memberCount})</span>
                                  </>
                                ) : (
                                  <>
                                    <span translate="no">{letterForIndex(colorIndex)}</span>
                                    <span className="hidden md:inline text-xs ml-1 opacity-75">({memberCount})</span>
                                  </>
                                )}
                              </GroupTabsTrigger>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Second row: All tab and Consensus tab */}
                    <TabsTrigger
                      value="all"
                      style={{ gridRow: 2, gridColumn: 1 }}
                    >
                      All
                    </TabsTrigger>
                    <TabsTrigger
                      value="consensus"
                      className="relative"
                      style={{
                        gridRow: 2,
                        gridColumn: `2 / ${Math.max(sortedColors.length + 1, 2) + 1}`
                      }}
                    >
                      Consensus
                      <div className="absolute bottom-0 left-2 right-2 h-1 rounded-full flex overflow-hidden">
                        {sortedColors.map((colorIndex) => (
                          <div
                            key={colorIndex}
                            className="flex-1"
                            style={{ backgroundColor: colorIndex === UNPAINTED_VALUE ? "#000000" : PALETTE_COLORS[colorIndex] }}
                          />
                        ))}
                      </div>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* All tab - no vote stats calculation needed for performance */}
              <TabsContent value="all" className="select-text" translate="yes">
                <StatementTable
                  statements={statements}
                  onStatementClick={onStatementClick}
                  debugMode={debugMode}
                  dataset={dataset}
                  pointGroups={pointGroups}
                  activeColors={sortedColors}
                  displayMask={displayMask}
                  // Optimization: Don't pass vote stats props to avoid calculating stats for all statements
                  // Vote stats are only needed for group tabs (representative statements) and consensus tab
                />
              </TabsContent>

              {/* Consensus tab */}
              <TabsContent value="consensus" className="select-text" translate="yes">
                {isCalculatingRepStatements ? (
                  <div className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center space-x-2 text-gray-500">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                      <span className="text-sm">Calculating consensus statements...</span>
                    </div>
                  </div>
                ) : repStatementsError ? (
                  <div className="px-4 py-8 text-center">
                    <div className="text-red-500 text-sm">
                      <p className="mb-2">Error calculating consensus statements:</p>
                      <p className="text-xs">{repStatementsError}</p>
                    </div>
                  </div>
                ) : consensusStatements && (consensusStatements.agree.length > 0 || consensusStatements.disagree.length > 0) ? (
                  (() => {
                    const { agree, disagree } = convertConsensusStatementsToStatements();
                    const consensusColors = getConsensusStatementColors();
                    const hasAgree = agree.length > 0;
                    const hasDisagree = disagree.length > 0;

                    return (
                      <div className="space-y-6">
                        <div className="px-4 py-2 bg-gray-50 rounded-lg">
                          <h3 className="font-medium text-sm text-gray-700 mb-1">
                            Consensus Statements
                          </h3>
                          <p className="text-xs text-gray-500">
                            These statements show high consensus across all groups - either broad agreement or disagreement.
                          </p>
                        </div>

                        {hasAgree && (
                          <div className="space-y-2">
                            <div className="px-4">
                              <h4 className="font-medium text-sm text-green-700 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: VOTE_COLORS.agree }}></div>
                                High Agreement ({agree.length} statement{agree.length !== 1 ? 's' : ''})
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                Statements with broad consensus for agreement across groups.
                              </p>
                            </div>
                            <StatementTable
                              statements={agree}
                              onStatementClick={onStatementClick}
                              statementColors={consensusColors}
                              debugMode={debugMode}
                              dataset={dataset}
                              pointGroups={pointGroups}
                              activeColors={sortedColors}
                              displayMask={displayMask}
                              voteStats={voteStats}
                              loadingVoteStats={loadingVoteStats}
                              calculateVoteStatsForStatements={calculateVoteStatsForStatements}
                              setLoadingVoteStats={setLoadingVoteStats}
                            />
                          </div>
                        )}

                        {hasDisagree && (
                          <div className="space-y-2">
                            <div className="px-4">
                              <h4 className="font-medium text-sm text-red-700 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: VOTE_COLORS.disagree }}></div>
                                High Disagreement ({disagree.length} statement{disagree.length !== 1 ? 's' : ''})
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                Statements with broad consensus for disagreement across groups.
                              </p>
                            </div>
                            <StatementTable
                              statements={disagree}
                              onStatementClick={onStatementClick}
                              statementColors={consensusColors}
                              debugMode={debugMode}
                              dataset={dataset}
                              pointGroups={pointGroups}
                              activeColors={sortedColors}
                              displayMask={displayMask}
                              voteStats={voteStats}
                              loadingVoteStats={loadingVoteStats}
                              calculateVoteStatsForStatements={calculateVoteStatsForStatements}
                              setLoadingVoteStats={setLoadingVoteStats}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : sortedColors.length < 2 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="text-gray-500 text-sm">
                      <p className="mb-2">Paint at least two groups to calculate consensus statements.</p>
                      <p className="text-xs">
                        Consensus statements show areas of broad agreement or disagreement across all groups.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <div className="text-gray-500 text-sm">
                      <p className="mb-2">No consensus statements found.</p>
                      <p className="text-xs">
                        This means there are no statements with strong consensus across all groups.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Representative statements for each group */}
              {sortedColors.map((colorIndex) => {
                const groupRepStatements = getRepresentativeStatementsForGroup(colorIndex);
                const hasRepStatements = groupRepStatements.length > 0;
                const statementColors = getStatementColors(colorIndex);

                return (
                  <TabsContent
                    value={`group-${colorIndex}`}
                    className="select-text"
                    translate="yes"
                  >
                    {isCalculatingRepStatements ? (
                      <div className="px-4 py-8 text-center">
                        <div className="flex items-center justify-center space-x-2 text-gray-500">
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                          <span className="text-sm">Calculating representative statements...</span>
                        </div>
                      </div>
                    ) : repStatementsError ? (
                      <div className="px-4 py-8 text-center">
                        <div className="text-red-500 text-sm">
                          <p className="mb-2">Error calculating representative statements:</p>
                          <p className="text-xs">{repStatementsError}</p>
                        </div>
                      </div>
                    ) : hasRepStatements ? (
                      <div className="space-y-4">
                        <div className="px-4 py-2 bg-gray-50 rounded-lg">
                          <h3 className="font-medium text-sm text-gray-700 mb-1">
                            {colorIndex === UNPAINTED_VALUE ? (
                              "Representative Statements for Rest Group"
                            ) : (
                              <>Representative Statements for Group <span translate="no">{letterForIndex(colorIndex)}</span></>
                            )}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {colorIndex === UNPAINTED_VALUE ? (
                              "These statements are most representative of the remaining participants' opinion patterns."
                            ) : (
                              "These statements are most representative of this group's opinion patterns."
                            )}
                          </p>
                        </div>
                        <StatementTable
                          statements={groupRepStatements}
                          onStatementClick={onStatementClick}
                          statementColors={statementColors}
                          showGroupVotes={sortedColors.length > 1}
                          groupVoteData={groupVoteData}
                          includeMissingVotes={includeMissingVotes}
                          voteBarWidth={6}
                          voteBarHeight={20}
                          highlightGroupIndex={colorIndex}
                          onToggleMissingVotes={handleToggleMissingVotes}
                          debugMode={debugMode}
                          dataset={dataset}
                          pointGroups={pointGroups}
                          activeColors={sortedColors}
                          displayMask={displayMask}
                          voteStats={voteStats}
                          loadingVoteStats={loadingVoteStats}
                          calculateVoteStatsForStatements={calculateVoteStatsForStatements}
                          setLoadingVoteStats={setLoadingVoteStats}
                        />
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <div className="text-gray-500 text-sm">
                          <p className="mb-2">No representative statements found for this group.</p>
                          <p className="text-xs">
                            Paint more groups and make selections to calculate representative statements.
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                );
              })}

            </Tabs>
          </div>
        </DrawerContent>
    </Drawer>
  );
};
