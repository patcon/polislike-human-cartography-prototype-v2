import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Statement } from "./StatementExplorerDrawer";

type StatementTableProps = {
  statements: Statement[];
  onStatementClick?: (statementId: number) => void;
  statementColors?: Record<number, string>;
};

export const StatementTable: React.FC<StatementTableProps> = ({ statements, onStatementClick, statementColors }) => {
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
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
