"use client";

import * as React from "react";
import { D3Map } from "./D3Map";
import { MapOverlay } from "./MapOverlay";
import { ParticipantCountBar } from "./ParticipantCountBar";
import { ClearColorsDialog } from "./ClearColorsDialog";
import { FloatingModal } from "./FloatingModal";
import { INITIAL_ACTION, PALETTE_COLORS, VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS, UNPAINTED_VALUE } from "@/constants";
import { PathasLogo } from "./PathasLogo";
import { getVotesForParticipants, getVoteCountsForAllParticipants, initializeDuckDB } from "../../lib/duckdb";
import { resolveAssetPath } from "../../lib/paths";
import { Spinner } from "../ui/spinner";
import {
  calculateRepresentativeStatements,
  createStatementTextMap,
  getLabelArrayWithOptionalUngrouped,
} from "../../lib/representative-statements";
import type { FinalizedCommentStats, ConsensusStatement } from "@/lib/stats";
import { fetchAndProcessKedroData, loadStatementsData } from "@/lib/kedro-api";
import { useDebugMode } from "../../hooks/useDebugMode";
import { useShiftKeyTempMode } from "../../hooks/useShiftKeyTempMode";
import { useLayerModeCycling } from "../../hooks/useLayerModeCycling";

// Helper function for ID matching - can be optimized later for performance
function findDatasetIndex(dataset: [string, [number, number]][], targetId: number | string): number {
  // Convert both to strings for comparison to handle mixed types
  // TODO: Check if this causes a performance hit.
  const targetIdStr = String(targetId);
  return dataset.findIndex((d) => String(d[0]) === targetIdStr);
}

type AppProps = {
  testAnimation?: boolean;
  kedroBaseUrl?: string;
  pipelineId?: string;
};

export const App: React.FC<AppProps> = ({ testAnimation = false, kedroBaseUrl, pipelineId }) => {
  const [dataset, setDataset] = React.useState<[string, [number, number]][]>([]);
  const [statements, setStatements] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [, setSelectedIds] = React.useState<number[]>([]);
  const [action, setAction] = React.useState<"move-map" | "paint-groups">(INITIAL_ACTION);

  // current palette index chosen in the overlay - default to 1 (orange)
  const [colorIndex, setColorIndex] = React.useState(1);

  const [toggles, setToggles] = React.useState<string[]>([]);

  // Colors to front toggle state
  const colorsToFront = toggles.includes("colors-to-front");

  // Layer mode: "groups", "votes", or "metrics"
  const [layerMode, setLayerMode] = React.useState<"groups" | "votes" | "metrics">("groups");

  // Statement ID for votes mode (user configurable)
  const [statementId, setStatementId] = React.useState("6");

  // Highlight pass votes toggle state
  const [highlightPassVotes, setHighlightPassVotes] = React.useState(true);

  // array parallel to dataset: UNPAINTED_VALUE = ungrouped, number = palette index (for groups mode)
  const [pointGroups, setPointGroups] = React.useState<number[]>([]);

  // array parallel to dataset: vote-based color indices (for votes mode)
  const [pointVotes, setPointVotes] = React.useState<(number | null)[]>([]);

  // array parallel to dataset: metrics values 0-1 (for metrics mode)
  const [pointMetrics, setPointMetrics] = React.useState<(number | null)[]>([]);

  // Debug mode state
  const debugMode = useDebugMode();

  // Shift key temporary mode switching
  const { effectiveMode } = useShiftKeyTempMode({
    currentMode: action,
    onModeChange: setAction
  });

  // Layer mode cycling for painting in non-group modes
  const { effectiveLayerMode, cycleOpacity, startCycle, stopCycle } = useLayerModeCycling({
    currentLayerMode: layerMode,
  });

  // StatementExplorerDrawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState("all");

  // Representative statements state
  const [representativeStatements, setRepresentativeStatements] = React.useState<Record<string, FinalizedCommentStats[]>>({});
  const [consensusStatements, setConsensusStatements] = React.useState<{ agree: ConsensusStatement[]; disagree: ConsensusStatement[] } | null>(null);
  const [isCalculatingRepStatements, setIsCalculatingRepStatements] = React.useState(false);
  const [repStatementsError, setRepStatementsError] = React.useState<string | null>(null);

  // Unpainted grouping state
  const [isUnpaintedGrouped, setIsUnpaintedGrouped] = React.useState(true);

  // Clear colors dialog state
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false);

  // Vote stats are now calculated at StatementExplorerDrawer level for better performance
  // Removed global vote stats calculation to avoid calculating stats for all statements

  // Load data and initialize DuckDB on component mount
  React.useEffect(() => {
    const init = async () => {
      try {
        if (kedroBaseUrl) {
          // Kedro mode: fetch data from Kedro API
          console.log('Loading data from Kedro API:', kedroBaseUrl);

          const [kedroData, statementsData] = await Promise.all([
            fetchAndProcessKedroData(kedroBaseUrl, pipelineId),
            loadStatementsData(kedroBaseUrl, pipelineId)
          ]);

          // Kedro data is already sorted in fetchAndProcessKedroData
          setDataset(kedroData);
          // Sort statements by statement_id to ensure consistent ordering
          setStatements([...statementsData].sort((a, b) => {
            // Try integer sorting first
            const aInt = parseInt(String(a.statement_id), 10);
            const bInt = parseInt(String(b.statement_id), 10);
            if (!isNaN(aInt) && !isNaN(bInt)) {
              return aInt - bInt;
            }
            // Fall back to string sorting
            return String(a.statement_id).localeCompare(String(b.statement_id));
          }));

          // Note: DuckDB initialization might not be needed for Kedro mode
          // depending on whether votes functionality is required
          await initializeDuckDB();
          console.log('Kedro data loaded and DuckDB initialized');
        } else {
          // Normal mode: load local JSON files
          console.log('Loading data from local JSON files');

          const [projectionsResponse, statementsResponse] = await Promise.all([
            fetch(resolveAssetPath('/projections.json')),
            fetch(resolveAssetPath('/statements.json'))
          ]);

          const projectionsData = await projectionsResponse.json();
          const statementsData = await statementsResponse.json();

          // Sort local projection data by participant ID to ensure consistent ordering
          const sortedProjectionsData = [...projectionsData].sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

          setDataset(sortedProjectionsData);
          // Sort statements by statement_id to ensure consistent ordering
          setStatements([...statementsData].sort((a, b) => {
            // Try integer sorting first
            const aInt = parseInt(String(a.statement_id), 10);
            const bInt = parseInt(String(b.statement_id), 10);
            if (!isNaN(aInt) && !isNaN(bInt)) {
              return aInt - bInt;
            }
            // Fall back to string sorting
            return String(a.statement_id).localeCompare(String(b.statement_id));
          }));

          await initializeDuckDB();
          console.log('Local data loaded and DuckDB initialized');
        }

        setLoading(false);
      } catch (err) {
        console.error('Data loading or DuckDB initialization error:', err);
        setLoading(false);
      }
    };

    init();
  }, [kedroBaseUrl, pipelineId]);

  // Keyboard shortcuts for color selection
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not typing in an input field
      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      // Handle number keys 1-9 and 0 for color selection
      if (event.key >= '1' && event.key <= '9') {
        const index = parseInt(event.key, 10);
        if (index <= PALETTE_COLORS.length) {
          setColorIndex(index);
          event.preventDefault();
        }
      } else if (event.key === '0') {
        // 0 key selects blue (index 0)
        setColorIndex(0);
        event.preventDefault();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete key selects eraser (UNPAINTED_VALUE)
        setColorIndex(UNPAINTED_VALUE);
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initialize point arrays when dataset is loaded
  React.useEffect(() => {
    if (dataset.length > 0) {
      setPointGroups(Array(dataset.length).fill(UNPAINTED_VALUE));
      setPointVotes(Array(dataset.length).fill(null));
      setPointMetrics(Array(dataset.length).fill(null));
    }
  }, [dataset]);

  // Load votes data when switching to votes mode or changing statement ID
  React.useEffect(() => {
    if (layerMode === "votes" && dataset.length > 0) {
      const loadVotes = async () => {
        try {
          // Use the current dataset instead of loading projections from file
          const participantIds = dataset.map(([id]) => id);
          const votes = await getVotesForParticipants(statementId, participantIds, kedroBaseUrl, pipelineId);

          // Create votes color indices array parallel to dataset
          const newPointVotes = dataset.map(([participantId]) => {
            const vote = votes.get(participantId) ?? null;

            if (vote === null) {
              return null; // Participant has no vote - should be black (unpainted)
            }

            // Map actual vote values to indices for color lookup
            switch (vote) {
              case 1: return 0;    // agree - green
              case -1: return 1;   // disagree - red
              case 0: return 2;    // pass - yellow
              default: return null; // no vote - black
            }
          });

          setPointVotes(newPointVotes);
        } catch (err) {
          console.error('Error loading votes:', err);
        }
      };

      loadVotes();
    }
  }, [layerMode, statementId, dataset, kedroBaseUrl, pipelineId]);

  // Load metrics data when switching to metrics mode
  React.useEffect(() => {
    if (layerMode === "metrics" && dataset.length > 0) {
      const loadMetrics = async () => {
        try {
          const voteCounts = await getVoteCountsForAllParticipants(kedroBaseUrl, pipelineId);

          // Create metrics values array parallel to dataset
          const newPointMetrics = dataset.map(([participantId]) => {
            return voteCounts.get(participantId) ?? null;
          });

          setPointMetrics(newPointMetrics);
        } catch (err) {
          console.error('Error loading metrics:', err);
        }
      };

      loadMetrics();
    }
  }, [layerMode, dataset, kedroBaseUrl, pipelineId]);

  const mode: "move" | "paint" = effectiveMode === "paint-groups" ? "paint" : "move";

  // Calculate representative statements
  const calculateRepStatements = React.useCallback(async (updatedPointGroups?: number[], updatedIsUnpaintedGrouped?: boolean) => {
    if (isCalculatingRepStatements) return;

    // Use the provided updated groups or fall back to current state
    const groupsToAnalyze = updatedPointGroups || pointGroups;

    // Use the provided updated unpainted grouped state or fall back to current state
    const unpaintedGroupedToUse = updatedIsUnpaintedGrouped !== undefined ? updatedIsUnpaintedGrouped : isUnpaintedGrouped;

    // Create statement text map
    const statementTextMap = createStatementTextMap(statements);

    // Get label array for analysis - include unpainted as a group if isUnpaintedGrouped is true
    const labelArray = getLabelArrayWithOptionalUngrouped(groupsToAnalyze, unpaintedGroupedToUse);

    // Check if we can perform analysis - count unique non-unpainted groups
    const uniqueGroups = new Set(labelArray.filter(label => label !== null));
    const canAnalyze = uniqueGroups.size >= 2;

    console.log(`Found ${uniqueGroups.size} unique groups:`, Array.from(uniqueGroups));

    if (!canAnalyze) {
      console.log('Cannot analyze: need at least 2 groups, found:', uniqueGroups.size);
      // Clear representative statements when below threshold to prevent stale data
      setRepresentativeStatements({});
      setConsensusStatements(null);
      setRepStatementsError(null);

      // Reset drawer to "all" tab when below threshold to prevent showing stale group tabs
      if (drawerTab !== "all") {
        setDrawerTab("all");
      }
      return;
    }

    setIsCalculatingRepStatements(true);
    setRepStatementsError(null);

    try {
      // Get participant IDs from dataset
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
          pipelineId
        }
      );

      setRepresentativeStatements(result.repComments);
      setConsensusStatements(result.consensusStatements);
      console.log('Representative statements calculated:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate representative statements';
      setRepStatementsError(errorMessage);
      console.error('Error calculating representative statements:', err);
    } finally {
      setIsCalculatingRepStatements(false);
    }
  }, [isCalculatingRepStatements, statements, pointGroups, dataset, drawerTab, setDrawerTab]);

  // Vote stats calculation removed from App level - now handled in StatementExplorerDrawer
  // This avoids calculating stats for all statements when only group tab statements need them

  // Detect if we're on a mobile device
  const isMobile = React.useMemo(() => {
    // Check for touch capability and mobile user agents
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return hasTouchScreen && (isMobileUserAgent || window.innerWidth <= 768);
  }, []);

  // Handle lasso start - trigger cycling if in non-group mode and paint mode (but not on mobile)
  const handleLassoStart = React.useCallback(() => {
    if (effectiveMode === "paint-groups" && layerMode !== "groups" && !isMobile) {
      startCycle();
    }
  }, [effectiveMode, layerMode, startCycle, isMobile]);

  // Handle lasso end - stop cycling
  const handleLassoEnd = React.useCallback(() => {
    stopCycle(); // Always call stopCycle to ensure cleanup
  }, [stopCycle]);

  // update both selectedIds and pointGroups when selection changes (painting allowed in all modes)
  function handleSelectionChange(ids: (number | string)[]) {
    setSelectedIds(ids as number[]);
    // Always allow painting - the cycling will show the groups layer when needed
    setPointGroups((prev) => {
      const next = [...prev];
      ids.forEach((id) => {
        // find index of this id in dataset using helper function
        const idx = findDatasetIndex(dataset, id);
        if (idx !== -1) {
          next[idx] = colorIndex;
        }
      });

      // Always trigger representative statements calculation when groups change
      // This ensures vote stats are recalculated even when painting in votes mode
      setTimeout(() => {
        calculateRepStatements(next);
      }, 50);

      return next;
    });
  }

  // Open clear colors dialog
  const handleOpenClearDialog = React.useCallback(() => {
    setClearDialogOpen(true);
  }, []);

  // Clear all painted colors - reset all points to unpainted
  const handleClearAllColors = React.useCallback(() => {
    setPointGroups(Array(dataset.length).fill(UNPAINTED_VALUE));

    // Clear representative statements since all groups are now empty
    setRepresentativeStatements({});
    setConsensusStatements(null);
    setRepStatementsError(null);

    // Reset drawer to "all" tab since group tabs are no longer valid
    if (drawerTab !== "all") {
      setDrawerTab("all");
    }

    console.log('All painted colors cleared');
  }, [dataset.length, drawerTab, setDrawerTab]);

  // handle quick select (single point click) - opens drawer to specific tab
  function handleQuickSelect(id: string): boolean {
    console.log('🔍 QuickSelect:', id, '(', typeof id, ')');

    // find the index of this point in the dataset
    const idx = findDatasetIndex(dataset, id);

    if (idx !== -1) {
      if (layerMode === "groups") {
        // get the color index for this point
        const pointColorIndex = pointGroups[idx];

        if (pointColorIndex !== UNPAINTED_VALUE) {
          const targetTab = `group-${pointColorIndex}`;
          console.log('  - Opening drawer to', targetTab);

          // open drawer to the specific group tab
          setDrawerTab(targetTab);
          setDrawerOpen(true);
          return true; // Successfully processed - prevent other behaviors
        } else {
          // Handle unpainted points when isUnpaintedGrouped is true
          if (isUnpaintedGrouped) {
            console.log('  - Opening drawer to unpainted tab');

            // open drawer to the unpainted group tab
            setDrawerTab(`group-${UNPAINTED_VALUE}`);
            setDrawerOpen(true);
            return true; // Successfully processed - prevent other behaviors
          } else {
            return false; // No action taken - allow lasso painting etc.
          }
        }
      } else if (layerMode === "votes") {
        // In votes mode, could show vote information
        const voteColorIndex = pointVotes[idx];

        if (voteColorIndex !== null) {
          const voteType = voteColorIndex === 0 ? 'agree' :
                          voteColorIndex === 1 ? 'disagree' : 'pass';
          console.log(`  - Participant ${id} voted: ${voteType}`);
          return true; // Successfully processed
        } else {
          return false; // No action taken
        }
      }
    }

    return false; // Default: allow other behaviors
  }

  if (loading) {
    return (
      <div className="relative h-screen w-screen flex items-center justify-center touch-none select-none">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">Loading opinion landscape explorer...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-screen w-screen"
      /**
       * Prevent Google Translate from modifying DOM during animations
       * which causes React "removeChild" errors when animating SVG elements
       */
      translate="no"
      data-notranslate="true"
    >
      <PathasLogo />

      {/* D3Map: absolutely positioned to fill parent */}
      <div className="absolute inset-0 z-0">
        <div
          data-layer-cycling
          style={{
            opacity: cycleOpacity,
            transition: `opacity 200ms ease-in` // Start with fast flash transition, will be dynamically updated
          }}
        >
          <D3Map
            data={dataset}
            mode={mode}
            pointColors={effectiveLayerMode === "votes" ? pointVotes :
                        effectiveLayerMode === "metrics" ? pointMetrics : pointGroups}
            palette={effectiveLayerMode === "votes" ?
              (highlightPassVotes ?
                [VOTE_COLORS_HIGHLIGHT_PASS.agree, VOTE_COLORS_HIGHLIGHT_PASS.disagree, VOTE_COLORS_HIGHLIGHT_PASS.pass] :
                [VOTE_COLORS.agree, VOTE_COLORS.disagree, VOTE_COLORS.pass]
              ) :
              PALETTE_COLORS}
            layerMode={effectiveLayerMode}
            onSelectionChange={handleSelectionChange}
            onQuickSelect={handleQuickSelect}
            onLassoStart={handleLassoStart}
            onLassoEnd={handleLassoEnd}
            flipX={toggles.includes("flip-horizontal")}
            flipY={toggles.includes("flip-vertical")}
            colorsToFront={colorsToFront}
            testAnimation={testAnimation}
            kedroBaseUrl={kedroBaseUrl}
            availablePipelines={kedroBaseUrl ? [] : undefined} // Will be populated by D3Map's usePipelineOptions
          />
        </div>
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 z-50 pointer-events-none">
        <MapOverlay
          action={effectiveMode}
          onActionChange={setAction}
          colorIndex={colorIndex}
          onColorIndexChange={setColorIndex}
          statements={statements}
          toggles={toggles}
          onTogglesChange={setToggles}
          pointGroups={pointGroups}
          drawerOpen={drawerOpen}
          onDrawerOpenChange={setDrawerOpen}
          drawerTab={drawerTab}
          onDrawerTabChange={setDrawerTab}
          layerMode={layerMode}
          onLayerModeChange={setLayerMode}
          statementId={statementId}
          onStatementIdChange={setStatementId}
          highlightPassVotes={highlightPassVotes}
          onHighlightPassVotesChange={setHighlightPassVotes}
          onClearAllColors={handleOpenClearDialog}
          // Representative statements props
          representativeStatements={representativeStatements}
          consensusStatements={consensusStatements}
          isCalculatingRepStatements={isCalculatingRepStatements}
          repStatementsError={repStatementsError}
          isUnpaintedGrouped={isUnpaintedGrouped}
          // Debug mode props
          debugMode={debugMode}
          dataset={dataset}
        />
      </div>

      {/* PointGroupBadges at the very bottom of the screen - positioned relative to screen-safe viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none" style={{ height: '100dvh', pointerEvents: 'none' }}>
        <div className="absolute bottom-0 left-0 right-0 pb-1 px-1 pointer-events-auto">
          <ParticipantCountBar
            pointGroups={pointGroups}
            isProportional={true}
            isUnpaintedGrouped={isUnpaintedGrouped}
            onUnpaintedGroupedChange={(newValue) => {
              setIsUnpaintedGrouped(newValue);
              // Trigger recalculation of representative statements when grouping changes
              if (pointGroups.length > 0) {
                // Use setTimeout to ensure state update has been processed
                setTimeout(() => {
                  calculateRepStatements(undefined, newValue);
                }, 50);
              }
            }}
          />
        </div>
      </div>

      {/* FloatingModal - shows current statement in votes mode */}
      {layerMode === "votes" && (
        <FloatingModal
          statement={(() => {
            const currentStatement = statements.find(s => String(s.statement_id) === statementId);
            return currentStatement ? {
              txt: currentStatement.txt || "",
              statement_id: currentStatement.statement_id,
              moderated: currentStatement.moderated
            } : {
              txt: `Statement ${statementId} not found`,
              statement_id: parseInt(statementId) || 0,
              moderated: 0
            };
          })()}
          isVisible={true}
          onClose={() => setLayerMode("groups")}
        />
      )}

      {/* Clear Colors Dialog */}
      <ClearColorsDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onConfirm={handleClearAllColors}
      />
    </div>
  );
};
