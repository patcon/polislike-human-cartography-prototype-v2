import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Statement } from "./StatementExplorerDrawer";
import { GroupVoteComparisonWidget, type GroupVoteData } from "./GroupVoteComparisonWidget";
import { VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS } from "@/constants";

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
}) => {
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
          <TableHead>Statement</TableHead>
          {showGroupVotes && (
            <TableHead className="text-center text-[12px] text-gray-400 w-24">
              Group Votes
            </TableHead>
          )}
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
              </TableCell>
              {showGroupVotes && (
                <TableCell className="text-center">
                  {groupVoteData?.[s.statement_id] ? (
                    <GroupVoteComparisonWidget
                      groupVotes={groupVoteData[s.statement_id]}
                      includeMissingVotes={includeMissingVotes}
                      height={voteBarHeight}
                      width={voteBarWidth}
                      className="justify-center"
                      voteColors={voteColors}
                      voteOrder={voteOrder}
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">No data</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
