import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Statement } from "./StatementExplorerDrawer";
import { GroupVoteComparisonWidget, type GroupVoteData } from "./GroupVoteComparisonWidget";
import { MissingVotesToggleButton } from "./MissingVotesToggleButton";
import { VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS } from "@/constants";
import { calculateStatementVoteStats, formatDebugVoteStats, type StatementDebugStats } from "@/lib/debug-vote-stats";

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
  kedroBaseUrl?: string;
  pipelineId?: string;
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
  kedroBaseUrl,
  pipelineId,
}) => {
  const handleToggleMissingVotes = React.useCallback(() => {
    onToggleMissingVotes?.();
  }, [onToggleMissingVotes]);

  // Debug vote stats state
  const [debugVoteStats, setDebugVoteStats] = React.useState<Record<number, StatementDebugStats>>({});
  const [loadingDebugStats, setLoadingDebugStats] = React.useState<Set<number>>(new Set());

  // Load debug vote stats when debug mode is enabled
  React.useEffect(() => {
    if (!debugMode || !dataset.length || !pointGroups.length || !activeColors.length) {
      setDebugVoteStats({});
      return;
    }

    const loadStatsForStatements = async () => {
      const newStats: Record<number, StatementDebugStats> = {};
      const loadingSet = new Set<number>();

      for (const statement of statements) {
        loadingSet.add(statement.statement_id);
        setLoadingDebugStats(prev => new Set([...prev, statement.statement_id]));

        try {
          const stats = await calculateStatementVoteStats(
            statement.statement_id,
            dataset,
            pointGroups,
            activeColors,
            kedroBaseUrl,
            pipelineId
          );
          newStats[statement.statement_id] = stats;
        } catch (error) {
          console.error(`Failed to load debug stats for statement ${statement.statement_id}:`, error);
        } finally {
          setLoadingDebugStats(prev => {
            const next = new Set(prev);
            next.delete(statement.statement_id);
            return next;
          });
        }
      }

      setDebugVoteStats(newStats);
    };

    loadStatsForStatements();
  }, [debugMode, statements, dataset, pointGroups, activeColors, kedroBaseUrl, pipelineId]);

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
                  {groupVoteData?.[s.statement_id] ? (
                    <div
                      className="cursor-pointer hover:bg-gray-100 rounded p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMissingVotes();
                      }}
                    >
                      <GroupVoteComparisonWidget
                        groupVotes={groupVoteData[s.statement_id]}
                        includeMissingVotes={includeMissingVotes}
                        height={voteBarHeight}
                        width={voteBarWidth}
                        className="justify-center"
                        voteColors={voteColors}
                        voteOrder={voteOrder}
                        highlightGroupIndex={highlightGroupIndex}
                      />
                    </div>
                  ) : null}
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
                
                {/* Debug mode: Show vote statistics */}
                {debugMode && (
                  <div className="mt-2 space-y-1">
                    {loadingDebugStats.has(s.statement_id) ? (
                      <div className="text-xs text-gray-400 italic">Loading debug stats...</div>
                    ) : debugVoteStats[s.statement_id] ? (
                      Object.entries(debugVoteStats[s.statement_id]).map(([groupIndex, stats]) => (
                        <div key={groupIndex} className="text-xs text-gray-500 opacity-60">
                          Group {groupIndex === '-1' ? 'X' : String.fromCharCode(65 + parseInt(groupIndex))}: {formatDebugVoteStats(stats)}
                        </div>
                      ))
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
