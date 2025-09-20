"use client";

import * as React from "react";
import { D3Map } from "./D3Map";
import { MapOverlay } from "./MapOverlay";
import { ParticipantCountBar } from "./ParticipantCountBar";
import { INITIAL_ACTION, PALETTE_COLORS, VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS } from "@/constants";
import { PathasLogo } from "./PathasLogo";
import { getParticipantDataForStatement, initializeDuckDB } from "../../lib/duckdb";
import { resolveAssetPath } from "../../lib/paths";
import { Spinner } from "../ui/spinner";
import {
  calculateRepresentativeStatements,
  createStatementTextMap,
  getLabelArrayWithOptionalUngrouped,
} from "../../lib/representative-statements";
import type { FinalizedCommentStats } from "@/lib/stats";

// Helper function for ID matching - can be optimized later for performance
function findDatasetIndex(dataset: [number, [number, number]][], targetId: number | string): number {
  // Convert both to strings for comparison to handle mixed types
  // TODO: Check if this causes a performance hit.
  const targetIdStr = String(targetId);
  return dataset.findIndex((d) => String(d[0]) === targetIdStr);
}

type AppProps = {
  testAnimation?: boolean;
};

export const App: React.FC<AppProps> = ({ testAnimation = false }) => {
  const [dataset, setDataset] = React.useState<[number, [number, number]][]>([]);
  const [statements, setStatements] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [, setSelectedIds] = React.useState<number[]>([]);
  const [action, setAction] = React.useState<"move-map" | "paint-groups">(INITIAL_ACTION);

  // current palette index chosen in the overlay
  const [colorIndex, setColorIndex] = React.useState(0);

  const [toggles, setToggles] = React.useState<string[]>([]);

  // Layer mode: "groups" or "votes"
  const [layerMode, setLayerMode] = React.useState<"groups" | "votes">("groups");
  
  // Statement ID for votes mode (user configurable)
  const [statementId, setStatementId] = React.useState("6");
  
  // Highlight pass votes toggle state
  const [highlightPassVotes, setHighlightPassVotes] = React.useState(true);

  // array parallel to dataset: null = ungrouped, number = palette index (for groups mode)
  const [pointGroups, setPointGroups] = React.useState<(number | null)[]>([]);

  // array parallel to dataset: vote-based color indices (for votes mode)
  const [pointVotes, setPointVotes] = React.useState<(number | null)[]>([]);

  // StatementExplorerDrawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState("all");

  // Representative statements state
  const [representativeStatements, setRepresentativeStatements] = React.useState<Record<string, FinalizedCommentStats[]>>({});
  const [isCalculatingRepStatements, setIsCalculatingRepStatements] = React.useState(false);
  const [repStatementsError, setRepStatementsError] = React.useState<string | null>(null);

  // Load data and initialize DuckDB on component mount
  React.useEffect(() => {
    const init = async () => {
      try {
        // Load both datasets in parallel
        const [projectionsResponse, statementsResponse] = await Promise.all([
          fetch(resolveAssetPath('/projections.json')),
          fetch(resolveAssetPath('/statements.json'))
        ]);

        const projectionsData = await projectionsResponse.json();
        const statementsData = await statementsResponse.json();

        setDataset(projectionsData);
        setStatements(statementsData);

        await initializeDuckDB();
        console.log('DuckDB initialized in App component');
        setLoading(false);
      } catch (err) {
        console.error('Data loading or DuckDB initialization error:', err);
        setLoading(false);
      }
    };

    init();
  }, []);

  // Initialize point arrays when dataset is loaded
  React.useEffect(() => {
    if (dataset.length > 0) {
      setPointGroups(Array(dataset.length).fill(null));
      setPointVotes(Array(dataset.length).fill(null));
    }
  }, [dataset]);

  // Load votes data when switching to votes mode or changing statement ID
  React.useEffect(() => {
    if (layerMode === "votes") {
      const loadVotes = async () => {
        try {
          console.log(`Loading votes for statement ${statementId}`);
          const participantData = await getParticipantDataForStatement(statementId);
          
          // Create a map for quick lookup
          // voteMap variable removed as it was unused
          
          // Create votes color indices array parallel to dataset
          const newPointVotes = dataset.map(([participantId]) => {
            const participantVoteData = participantData.find(p => p.participantId === participantId.toString());
            
            if (!participantVoteData || participantVoteData.vote === null) {
              // Participant has no vote - should be black (unpainted)
              return null;
            }
            
            // Map actual vote values to indices for color lookup
            switch (participantVoteData.vote) {
              case 1: return 0;    // agree - green
              case -1: return 1;   // disagree - red
              case 0: return 2;    // pass - yellow
              default: return null; // no vote - black
            }
          });
          
          setPointVotes(newPointVotes);
          console.log('Loaded votes data for visualization');
        } catch (err) {
          console.error('Error loading votes:', err);
        }
      };
      
      loadVotes();
    }
  }, [layerMode, statementId]);

  const mode: "move" | "paint" = action === "paint-groups" ? "paint" : "move";

  // Calculate representative statements
  const calculateRepStatements = React.useCallback(async (updatedPointGroups?: (number | null)[]) => {
    if (layerMode !== "groups" || isCalculatingRepStatements) return;

    // Use the provided updated groups or fall back to current state
    const groupsToAnalyze = updatedPointGroups || pointGroups;

    // Create statement text map
    const statementTextMap = createStatementTextMap(statements);

    // Get label array for analysis
    const labelArray = getLabelArrayWithOptionalUngrouped(groupsToAnalyze, false);

    // Check if we can perform analysis - count unique non-unpainted groups
    const uniqueGroups = new Set(labelArray.filter(label => label !== null));
    const canAnalyze = uniqueGroups.size >= 2;

    console.log(`Found ${uniqueGroups.size} unique groups:`, Array.from(uniqueGroups));

    if (!canAnalyze) {
      console.log('Cannot analyze: need at least 2 groups, found:', uniqueGroups.size);
      return;
    }

    setIsCalculatingRepStatements(true);
    setRepStatementsError(null);

    try {
      // Get participant IDs from dataset
      const participants = dataset.map(([participantId]) => participantId.toString());

      const result = await calculateRepresentativeStatements(
        labelArray,
        participants,
        statementTextMap,
        {
          includeModerated: false,
          minVoteCount: 1,
          maxStatementsCount: 10
        }
      );

      setRepresentativeStatements(result.repComments);
      console.log('Representative statements calculated:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate representative statements';
      setRepStatementsError(errorMessage);
      console.error('Error calculating representative statements:', err);
    } finally {
      setIsCalculatingRepStatements(false);
    }
  }, [layerMode, isCalculatingRepStatements, statements, pointGroups, dataset]);

  // update both selectedIds and pointGroups when selection changes (only in groups mode)
  function handleSelectionChange(ids: (number | string)[]) {
    setSelectedIds(ids as number[]);
    if (layerMode === "groups") {
      setPointGroups((prev) => {
        const next = [...prev];
        ids.forEach((id) => {
          // find index of this id in dataset using helper function
          const idx = findDatasetIndex(dataset, id);
          if (idx !== -1) {
            next[idx] = colorIndex;
          }
        });

        // Trigger representative statements calculation with the updated groups
        // Pass the updated state directly to avoid timing issues
        setTimeout(() => {
          calculateRepStatements(next);
        }, 100);

        return next;
      });
    }
  }

  // handle quick select (single point click) - opens drawer to specific tab
  function handleQuickSelect(id: number): boolean {
    console.log('🔍 QuickSelect:', id, '(', typeof id, ')');
    
    // find the index of this point in the dataset
    const idx = findDatasetIndex(dataset, id);
    
    if (idx !== -1) {
      if (layerMode === "groups") {
        // get the color index for this point
        const pointColorIndex = pointGroups[idx];
        
        if (pointColorIndex !== null) {
          const targetTab = `group-${pointColorIndex}`;
          console.log('  - Opening drawer to', targetTab);
          
          // open drawer to the specific group tab
          setDrawerTab(targetTab);
          setDrawerOpen(true);
          return true; // Successfully processed - prevent other behaviors
        } else {
          return false; // No action taken - allow lasso painting etc.
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
    <div className="relative h-screen w-screen">
      <PathasLogo />

      {/* D3Map: absolutely positioned to fill parent */}
      <div className="absolute inset-0 z-0">
        <D3Map
          data={dataset}
          mode={mode}
          pointColors={layerMode === "votes" ? pointVotes : pointGroups}
          palette={layerMode === "votes" ?
            (highlightPassVotes ?
              [VOTE_COLORS_HIGHLIGHT_PASS.agree, VOTE_COLORS_HIGHLIGHT_PASS.disagree, VOTE_COLORS_HIGHLIGHT_PASS.pass] :
              [VOTE_COLORS.agree, VOTE_COLORS.disagree, VOTE_COLORS.pass]
            ) :
            PALETTE_COLORS}
          onSelectionChange={handleSelectionChange}
          onQuickSelect={handleQuickSelect}
          flipX={toggles.includes("flip-horizontal")}
          flipY={toggles.includes("flip-vertical")}
          testAnimation={testAnimation}
        />
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 z-50 pointer-events-none">
        <MapOverlay
          action={action}
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
          // Representative statements props
          representativeStatements={representativeStatements}
          isCalculatingRepStatements={isCalculatingRepStatements}
          repStatementsError={repStatementsError}
        />
      </div>

      {/* PointGroupBadges at the very bottom of the screen */}
      <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="pb-1 px-1 pointer-events-auto">
          <ParticipantCountBar
            pointGroups={pointGroups}
            isProportional={true}
          />
        </div>
      </div>
    </div>
  );
};
