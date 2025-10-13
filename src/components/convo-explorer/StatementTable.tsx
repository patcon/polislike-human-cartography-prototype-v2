import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Statement } from "./StatementExplorerDrawer";
import { GroupVoteComparisonWidget, type GroupVoteData } from "./GroupVoteComparisonWidget";
import { MissingVotesToggleButton } from "./MissingVotesToggleButton";
import { VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS } from "@/constants";
import { formatVoteStats, type StatementVoteStats } from "@/lib/vote-stats";

type StatementTableProps = {
  statements: Statement[];
  onStatementClick?: (statementId: number) => void;
  statementColors?: Record<number, string>;
  groupVoteData?: Record<number, GroupVoteData[]>; // statementId -> group vote data
  showGroupVotes?: boolean;
  includeMissingVotes?: boolean;
  voteColors?: typeof VOTE_COLORS | typeof VOTE_COLORS_HIGHLIGHT_PASS;
  voteOrder?: string;
  voteBarWidth?: number;
  voteBarHeight?: number;
  highlightGroupIndex?: number; // Group index to highlight in vote comparison widgets
  onToggleMissingVotes?: () => void; // Callback to toggle includeMissingVotes

  // Debug mode props
  debugMode?: boolean;
  dataset?: [string, [number, number]][];
  pointGroups?: number[];
  activeColors?: number[];

  // Vote stats props (calculated at App level)
  voteStats?: Record<number, StatementVoteStats>;
  loadingVoteStats?: Set<number>;
  setLoadingVoteStats?: React.Dispatch<React.SetStateAction<Set<number>>>;
  calculateVoteStatsForStatements?: (statementIds: number[]) => Promise<void>;
};

export const StatementTable: React.FC<StatementTableProps> = ({
  statements,
  onStatementClick,
  statementColors,
  groupVoteData,
  showGroupVotes = false,
  includeMissingVotes = false,
  voteColors = VOTE_COLORS,
  voteOrder = "UDPA",
  voteBarWidth = 12,
  voteBarHeight = 30,
  highlightGroupIndex,
  onToggleMissingVotes,

  // Debug mode props
  debugMode = false,
  dataset = [],
  pointGroups = [],
  activeColors = [],

  // Vote stats props
  voteStats = {},
  loadingVoteStats = new Set(),
  calculateVoteStatsForStatements,
}) => {
  const handleToggleMissingVotes = React.useCallback(() => {
    onToggleMissingVotes?.();
  }, [onToggleMissingVotes]);

  // Auto-calculate vote stats for displayed statements when component mounts or statements change
  React.useEffect(() => {
    if (calculateVoteStatsForStatements && statements.length > 0) {
      const statementIds = statements.map(s => s.statement_id);
      // Only calculate for statements that don't already have stats and aren't currently loading
      const missingStatementIds = statementIds.filter(id =>
        !voteStats[id] && !loadingVoteStats.has(id)
      );

      if (missingStatementIds.length > 0) {
        console.log('🔍 StatementTable: Auto-calculating vote stats for', missingStatementIds.length, 'statements');
        calculateVoteStatsForStatements(missingStatementIds);
      }
    }
  }, [statements, calculateVoteStatsForStatements, voteStats, loadingVoteStats]);

  // Convert vote stats to GroupVoteData format for widgets
  const convertVoteStatsToGroupVoteData = React.useCallback((statementId: number): GroupVoteData[] | undefined => {
    const stats = voteStats[statementId];
    if (!stats || !dataset.length || !pointGroups.length) {
      return undefined;
    }

    // Calculate actual group sizes from pointGroups
    const groupSizes: Record<number, number> = {};
    pointGroups.forEach(group => {
      groupSizes[group] = (groupSizes[group] || 0) + 1;
    });

    // Convert vote stats to GroupVoteData format
    const groupVotes: GroupVoteData[] = [];
    Object.entries(stats).forEach(([groupIndexStr, groupStats]) => {
      const groupIndex = parseInt(groupIndexStr);
      if (activeColors.includes(groupIndex) && typeof groupStats === 'object' && groupStats !== null) {
        const typedStats = groupStats as { agree: number; disagree: number; pass: number; total: number };
        groupVotes.push({
          groupIndex,
          n_agree: typedStats.agree,
          n_disagree: typedStats.disagree,
          n_pass: typedStats.pass,
          n_trials: typedStats.total,
          totalGroupSize: groupSizes[groupIndex] || typedStats.total,
        });
      }
    });

    return groupVotes.length > 1 ? groupVotes : undefined;
  }, [voteStats, dataset, pointGroups, activeColors]);


  const insertBreaks = (val: string | null | undefined) => {
    if (!val) return "";
    const ZWSP = "\u200B";
    return val
      .replace(/(?<!:)\/(?!\/)/g, "/" + ZWSP)
      .replace(/,(?!\s)/g, "," + ZWSP)
      .replace(/([A-Za-z]{20})(?=[A-Za-z])/g, "$1" + ZWSP);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right text-[12px] text-gray-400">#</TableHead>
          {showGroupVotes && (
            <TableHead className="w-8 text-center">
              <MissingVotesToggleButton
                includeMissingVotes={includeMissingVotes}
                onToggle={handleToggleMissingVotes}
              />
            </TableHead>
          )}
          <TableHead>Statement</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statements.map((s) => {
          const badgeColor = statementColors?.[s.statement_id];
          return (
            <TableRow
              key={s.statement_id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onStatementClick?.(s.statement_id)}
            >
              <TableCell className="whitespace-nowrap text-right w-12 text-[12px]">
                {badgeColor ? (
                  <Badge
                    className="text-white text-[10px] px-1.5 py-0.5 min-w-[24px] justify-center"
                    style={{ backgroundColor: badgeColor }}
                  >
                    {s.statement_id}
                  </Badge>
                ) : (
                  <span className="text-gray-400">{s.statement_id}</span>
                )}
              </TableCell>
              {showGroupVotes && (
               <TableCell className="text-center w-8 px-1">
                 {(() => {
                   // Use vote stats to generate widget data for immediate updates
                   const widgetData = convertVoteStatsToGroupVoteData(s.statement_id) || groupVoteData?.[s.statement_id];
                   return widgetData ? (
                     <div
                       className="cursor-pointer hover:bg-gray-100 rounded p-1"
                       onClick={(e) => {
                         e.stopPropagation();
                         handleToggleMissingVotes();
                       }}
                     >
                       <GroupVoteComparisonWidget
                         groupVotes={widgetData}
                         includeMissingVotes={includeMissingVotes}
                         height={voteBarHeight}
                         width={voteBarWidth}
                         className="justify-center"
                         voteColors={voteColors}
                         voteOrder={voteOrder}
                         highlightGroupIndex={highlightGroupIndex}
                       />
                     </div>
                   ) : null;
                 })()}
               </TableCell>
             )}
              <TableCell className="whitespace-normal">
                <span
                  className={`
                    ${s.moderated === -1 ? "text-red-700" : ""}
                    ${s.moderated === 0 ? "text-gray-500" : ""}
                    ${s.moderated === 1 ? "text-gray-900" : ""}
                  `}
                >
                  {insertBreaks(s.txt)}
                  {s.moderated === -1 ? " (moderated)" : ""}
                  {s.moderated === 0 ? " (unmoderated)" : ""}
                </span>

                {/* Debug mode: Show vote statistics with fixed height */}
                {debugMode && (
                  <div className="mt-2 min-h-[60px] flex flex-col justify-start">
                    {loadingVoteStats.has(s.statement_id) ? (
                      <div className="text-xs text-gray-400 italic">Loading debug stats...</div>
                    ) : voteStats[s.statement_id] ? (
                      <div className="space-y-1">
                        {Object.entries(voteStats[s.statement_id]).map(([groupIndex, stats]) => (
                          <div key={groupIndex} className="text-xs text-gray-500 opacity-60">
                            Group {groupIndex === '-1' ? 'X' : String.fromCharCode(65 + parseInt(groupIndex))}: {formatVoteStats(stats)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No debug stats available</div>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
