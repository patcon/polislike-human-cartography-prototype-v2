// StatementExplorerDrawer.tsx
"use client";

import * as React from "react";
import {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { StatementTable } from "./StatementTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatementExplorerButton } from "./StatementExplorerButton";
import { Badge } from "@/components/ui/badge";
import { PALETTE_COLORS, VOTE_COLORS, isUnpainted } from "@/constants";
import { X } from "lucide-react";
import type { FinalizedCommentStats } from "@/lib/stats";

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
  isCalculatingRepStatements?: boolean;
  repStatementsError?: string | null;
  isUnpaintedGrouped?: boolean;
  pointGroups?: (number | null)[]; // Add pointGroups to check for unpainted participants

  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;

  tabValue?: string;
  onTabValueChange?: (v: string) => void;
  defaultTab?: string;

  onStatementClick?: (statementId: number) => void;
};

export const StatementExplorerDrawer: React.FC<StatementExplorerDrawerProps> = ({
  statements,
  activeColors = [],
  representativeStatements = {},
  isCalculatingRepStatements = false,
  repStatementsError = null,
  isUnpaintedGrouped = false,
  pointGroups = [],

  open,
  onOpenChange,
  defaultOpen = false,

  tabValue,
  onTabValueChange,
  defaultTab = "all",

  onStatementClick,
}) => {
  const [internalOpen, setInternalOpen] = React.useState<boolean>(defaultOpen);
  const [internalTab, setInternalTab] = React.useState<string>(defaultTab);

  const isOpen = open ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  const activeTab = tabValue ?? internalTab;
  const handleTabChange = onTabValueChange ?? setInternalTab;

  const letterForIndex = (index: number) => String.fromCharCode(65 + index);
  const sortedColors = React.useMemo(() =>
    [...activeColors].filter(index => !isUnpainted(index)).sort((a, b) => a - b),
    [activeColors]
  );

  // Check if unpainted group should be shown as a tab
  const hasUnpaintedGroup = React.useMemo(() => {
    return isUnpaintedGrouped && pointGroups.some(group => isUnpainted(group));
  }, [isUnpaintedGrouped, pointGroups]);

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

  // Get representative statements for unpainted group
  const getRepresentativeStatementsForUnpainted = (): Statement[] => {
    const unpaintedKey = 'unpainted'; // Use 'unpainted' as the key for unpainted group
    const repStats = representativeStatements[unpaintedKey] || [];
    return convertRepStatementsToStatements(repStats);
  };

  // Generate statement colors for unpainted group
  const getStatementColorsForUnpainted = (): Record<number, string> => {
    const unpaintedKey = 'unpainted';
    const repStats = representativeStatements[unpaintedKey] || [];
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

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} defaultOpen={defaultOpen}>
      <DrawerTrigger asChild>
        <StatementExplorerButton iconVariant="telescope" label="Explore Statements" />
      </DrawerTrigger>

      <DrawerPortal>
        <DrawerOverlay />

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
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              {/* Sticky tabs container */}
              <div className="sticky top-0 z-10 bg-white shadow-md">
                <TabsList className="flex flex-wrap w-full gap-2 bg-white h-auto px-4 pb-2">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {sortedColors.map((colorIndex) => (
                    <TabsTrigger key={colorIndex} value={`group-${colorIndex}`}>
                      <Badge
                        className="h-5 w-8 rounded-xlg"
                        style={{
                          backgroundColor: PALETTE_COLORS[colorIndex],
                          color: "white"
                        }}
                      >
                        {letterForIndex(colorIndex)}
                      </Badge>
                    </TabsTrigger>
                  ))}
                  {hasUnpaintedGroup && (
                    <TabsTrigger value="unpainted">
                      <Badge
                        className="h-5 rounded-xlg bg-black text-white"
                      >
                        Rest
                      </Badge>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              {/* All tab */}
              <TabsContent value="all" className="select-text">
                <StatementTable statements={statements} onStatementClick={onStatementClick} />
              </TabsContent>

              {/* Representative statements for each group */}
              {sortedColors.map((colorIndex) => {
                const groupRepStatements = getRepresentativeStatementsForGroup(colorIndex);
                const hasRepStatements = groupRepStatements.length > 0;
                const statementColors = getStatementColors(colorIndex);

                return (
                  <TabsContent
                    key={colorIndex}
                    value={`group-${colorIndex}`}
                    className="select-text"
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
                            Representative Statements for Group {letterForIndex(colorIndex)}
                          </h3>
                          <p className="text-xs text-gray-500">
                            These statements are most representative of this group's opinion patterns.
                          </p>
                        </div>
                        <StatementTable
                          statements={groupRepStatements}
                          onStatementClick={onStatementClick}
                          statementColors={statementColors}
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

              {/* Unpainted group tab */}
              {hasUnpaintedGroup && (
                <TabsContent value="unpainted" className="select-text">
                  {(() => {
                    const unpaintedRepStatements = getRepresentativeStatementsForUnpainted();
                    const hasRepStatements = unpaintedRepStatements.length > 0;
                    const statementColors = getStatementColorsForUnpainted();

                    return (
                      <>
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
                                Representative Statements for Rest Group
                              </h3>
                              <p className="text-xs text-gray-500">
                                These statements are most representative of the remaining participants' opinion patterns.
                              </p>
                            </div>
                            <StatementTable
                              statements={unpaintedRepStatements}
                              onStatementClick={onStatementClick}
                              statementColors={statementColors}
                            />
                          </div>
                        ) : (
                          <div className="px-4 py-8 text-center">
                            <div className="text-gray-500 text-sm">
                              <p className="mb-2">No representative statements found for the rest group.</p>
                              <p className="text-xs">
                                Make selections to calculate representative statements for remaining participants.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>
              )}
            </Tabs>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
};
