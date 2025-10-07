"use client";

import * as React from "react";
import { ActionToolBar } from "./ActionToolBar";
import { LayerConfigDrawer } from "./LayerConfigDrawer";
import { StatementExplorerDrawer } from "./StatementExplorerDrawer";
import { PalettePopover } from "./PalettePopover";
import { ToggleToolBar } from "./ToggleToolBar";
import { AboutDialog } from "./AboutDialog";
import { INITIAL_ACTION, UNPAINTED_VALUE } from "@/constants";
import type { Statement } from "./StatementExplorerDrawer";
import type { FinalizedCommentStats, ConsensusStatement } from "@/lib/stats";

type MapOverlayProps = {
  action?: "move-map" | "paint-groups";
  onActionChange?: (value: "move-map" | "paint-groups") => void;
  colorIndex?: number; // 👈 new
  onColorIndexChange?: (index: number) => void; // 👈 new
  statements?: Statement[];
  toggles?: string[];
  onTogglesChange?: (values: string[]) => void;
  pointGroups?: number[]; // 👈 NEW: palette index per point
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  drawerTab?: string;
  onDrawerTabChange?: (tab: string) => void;
  layerMode?: "groups" | "votes";
  onLayerModeChange?: (mode: "groups" | "votes") => void;
  statementId?: string;
  onStatementIdChange?: (statementId: string) => void;
  highlightPassVotes?: boolean;
  onHighlightPassVotesChange?: (value: boolean) => void;
  isUnpaintedGrouped?: boolean;
  onClearAllColors?: () => void;

  // Representative statements props
  representativeStatements?: Record<string, FinalizedCommentStats[]>;
  consensusStatements?: { agree: ConsensusStatement[]; disagree: ConsensusStatement[] } | null;
  isCalculatingRepStatements?: boolean;
  repStatementsError?: string | null;

  // Debug mode props
  debugMode?: boolean;
  dataset?: [string, [number, number]][];
};

export function MapOverlay({
  action: controlledAction,
  onActionChange,
  colorIndex: controlledColorIndex,
  onColorIndexChange,
  statements = [],
  toggles: controlledToggles,
  onTogglesChange,
  pointGroups = [],
  drawerOpen: controlledDrawerOpen,
  onDrawerOpenChange,
  drawerTab: controlledDrawerTab,
  onDrawerTabChange,
  layerMode = "groups",
  onLayerModeChange,
  statementId = "0",
  onStatementIdChange,
  highlightPassVotes = true,
  onHighlightPassVotesChange,
  isUnpaintedGrouped = false,
  onClearAllColors,

  // Representative statements props
  representativeStatements = {},
  consensusStatements = null,
  isCalculatingRepStatements = false,
  repStatementsError = null,

  // Debug mode props
  debugMode = false,
  dataset = [],
}: MapOverlayProps) {
  // if no props passed, create local state
  const [internalAction, setInternalAction] = React.useState<"move-map" | "paint-groups">(INITIAL_ACTION);
  const action = controlledAction ?? internalAction;
  const handleActionChange = onActionChange ?? setInternalAction;

  // local colorIndex fallback
  const [internalColorIndex, setInternalColorIndex] = React.useState(0);
  const colorIndex = controlledColorIndex ?? internalColorIndex;
  const handleColorIndexChange = onColorIndexChange ?? setInternalColorIndex;

  // Toggles
  const [internalToggles, setInternalToggles] = React.useState<string[]>([]);
  const toggles = controlledToggles ?? internalToggles;
  const handleTogglesChange = onTogglesChange ?? setInternalToggles;

  // Drawer state
  const [internalDrawerOpen, setInternalDrawerOpen] = React.useState(false);
  const drawerOpen = controlledDrawerOpen ?? internalDrawerOpen;
  const handleDrawerOpenChange = onDrawerOpenChange ?? setInternalDrawerOpen;

  const [internalDrawerTab, setInternalDrawerTab] = React.useState("all");
  const drawerTab = controlledDrawerTab ?? internalDrawerTab;
  const handleDrawerTabChange = onDrawerTabChange ?? setInternalDrawerTab;

  // --- NEW: compute activeColors from pointGroups ---
  const activeColors = React.useMemo(() => {
    const filtered = pointGroups.filter((x): x is number => x !== UNPAINTED_VALUE);
    const unique = [...new Set(filtered)];
    const hasUnpainted = pointGroups.some(group => group === UNPAINTED_VALUE);

    // Include UNPAINTED_VALUE in activeColors if there are unpainted points
    return hasUnpainted ? [...unique, UNPAINTED_VALUE] : unique;
  }, [pointGroups]);

  // Handle statement row click
  const handleStatementClick = React.useCallback((statementId: number) => {
    // Set the statement ID
    onStatementIdChange?.(statementId.toString());

    // Switch to votes layer mode
    onLayerModeChange?.("votes");

    // Close the drawer
    handleDrawerOpenChange(false);
  }, [onStatementIdChange, onLayerModeChange, handleDrawerOpenChange]);

  return (
    // Using the not-yet-fully supported 100dvh and 100dvw allows storybook's fullscreen iframe to work.
    // Might cause issues on older browsers. Would ideally be best to put this fix in on the storybook,
    // since it's only to get the iframe working...
    <div className="relative h-screen-safe w-screen-safe">
      <div className="absolute top-4 right-4 z-50 pointer-events-auto flex flex-col gap-2">
        <LayerConfigDrawer
          layerMode={layerMode}
          onLayerModeChange={onLayerModeChange}
          statementId={statementId}
          onStatementIdChange={onStatementIdChange}
          highlightPassVotes={highlightPassVotes}
          onHighlightPassVotesChange={onHighlightPassVotesChange}
          onActionChange={handleActionChange}
        />
        <StatementExplorerDrawer
          statements={statements}
          activeColors={activeColors}
          representativeStatements={representativeStatements}
          consensusStatements={consensusStatements}
          isCalculatingRepStatements={isCalculatingRepStatements}
          repStatementsError={repStatementsError}
          isUnpaintedGrouped={isUnpaintedGrouped}
          pointGroups={pointGroups}
          open={drawerOpen}
          onOpenChange={handleDrawerOpenChange}
          tabValue={drawerTab}
          onTabValueChange={handleDrawerTabChange}
          onStatementClick={handleStatementClick}
          debugMode={debugMode}
          dataset={dataset}
        />
        <AboutDialog autoOpen />
      </div>

      <div className="absolute left-4 right-4 bottom-11 z-50 flex justify-between items-center px-0 pointer-events-auto">
        <ToggleToolBar value={toggles} onValueChange={handleTogglesChange} />

        <div className="flex items-center gap-2">
          <ActionToolBar value={action} onValueChange={handleActionChange as (value: string) => void} />
          <PalettePopover
            activeIndex={colorIndex}
            onSelectIndex={handleColorIndexChange}
            onEraserReselect={onClearAllColors}
            disabled={action !== "paint-groups" || layerMode === "votes"} // 👈 disable palette when not painting or in votes mode
          />
        </div>
      </div>
    </div>
  );
}
