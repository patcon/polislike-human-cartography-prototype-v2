"use client";

import * as React from "react";
import { D3Map } from "./D3Map";
import { MapOverlay } from "./MapOverlay";
import { ParticipantCountBar } from "./ParticipantCountBar";
import { ClearColorsDialog } from "./ClearColorsDialog";
import { DownloadDialog } from "./DownloadDialog";
import { FloatingModal } from "./FloatingModal";
import { INITIAL_ACTION, PALETTE_COLOR_DEFINITIONS, PALETTE_COLORS, VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS, UNPAINTED_VALUE, DISPLAY_MASK_COLUMN } from "@/constants";
import { getVotesForParticipants, initializeDuckDB, loadVotesFromMemory, getAllVotes } from "../../lib/duckdb";
import { resolveAssetPath } from "../../lib/paths";
import { isWebAssemblySupported } from "../../lib/wasm-detect";
import { Spinner } from "../ui/spinner";
import { fetchAndProcessKedroData, loadStatementsData } from "@/lib/kedro-api";
import { useDebugMode } from "../../hooks/useDebugMode";
import { useShiftKeyTempMode } from "../../hooks/useShiftKeyTempMode";
import { useLayerModeCycling } from "../../hooks/useLayerModeCycling";
import type { ObsColumnInfo, LayerMatrix } from "@/lib/h5ad-loader";
import { useLerpedCoords } from "@/hooks/useLerpedCoords";
import { RecomputeProjectionDialog } from "./RecomputeProjectionDialog";
import { useRepresentativeStatements } from "@/hooks/useRepresentativeStatements";
import { useRecomputeDialog } from "@/hooks/useRecomputeDialog";
import { useMetricsLayer } from "@/hooks/useMetricsLayer";
import { FloatingModalV2Stack } from "./FloatingModalV2Stack";
import { calculateRepresentativeStatements, createStatementTextMap, type FinalizedCommentStats } from "@/lib/representative-statements";

// Helper function for ID matching - can be optimized later for performance
function findDatasetIndex(dataset: [string, [number, number]][], targetId: number | string): number {
  // Convert both to strings for comparison to handle mixed types
  // TODO: Check if this causes a performance hit.
  const targetIdStr = String(targetId);
  return dataset.findIndex((d) => String(d[0]) === targetIdStr);
}

export type PreloadedData = {
  dataset: [string, [number, number]][];
  statements: { statement_id: string; txt: string; moderated: number }[];
  votesRows: { participant_id: string; comment_id: string; vote: number }[];
  pipelineData?: Record<string, [string, [number, number]][]>;
  /** Full-dimension embeddings (>2D, e.g. PCA) for metrics layer */
  fullDimensionEmbeddings?: Record<string, [string, number[]][]>;
  /** Per-participant metadata columns from obs/ with type metadata */
  obsColumns?: Record<string, ObsColumnInfo>;
  /** Dense layer matrices from layers/ usable as input for in-browser reduction */
  layers?: Record<string, LayerMatrix>;
  /** Statement IDs in original h5ad var order — matches layer column indices. */
  varNames?: string[];
  /** Optional conversation identifier from uns['conversation_id'] */
  conversationId?: string;
};

type AppProps = {
  testAnimation?: boolean;
  kedroBaseUrl?: string;
  initialPipelineId?: string;
  pipelineFilter?: string;
  preloadedData?: PreloadedData;
  onLoadFile?: () => void;
  /** Enable the spotlight toolbar button (story-only; disabled in production by default) */
  enableSpotlight?: boolean;
};

export const App: React.FC<AppProps> = ({ testAnimation = false, kedroBaseUrl, initialPipelineId, pipelineFilter, preloadedData, onLoadFile, enableSpotlight = false }) => {
  const [dataset, setDataset] = React.useState<[string, [number, number]][]>([]);
  const [statements, setStatements] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [, setSelectedIds] = React.useState<number[]>([]);
  const [action, setAction] = React.useState<"move-map" | "paint-groups" | "spotlight">(INITIAL_ACTION);

  // Spotlight mode state
  const [spotlightStackItems, setSpotlightStackItems] = React.useState<
    { id: string | number; statement: { statement_id: number; txt: string }; variant: "agree" | "disagree"; onClick: () => void }[]
  >([]);
  const [activeSpotlightStatementId, setActiveSpotlightStatementId] = React.useState<string | null>(null);
  const [spotlightPointVotes, setSpotlightPointVotes] = React.useState<(number | null)[]>([]);
  const spotlightDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotlightLatestIdsRef = React.useRef<(string | number)[]>([]);

  // current palette index chosen in the overlay - default to 1 (orange)
  const [colorIndex, setColorIndex] = React.useState(1);

  const [toggles, setToggles] = React.useState<string[]>([]);

  // Pipeline-specific display state - stores flipX and flipY for each pipeline
  const [pipelineDisplayState, setPipelineDisplayState] = React.useState<Record<string, { flipX: boolean; flipY: boolean }>>({});

  // Current pipeline ID state - can be updated by D3Map pipeline selector
  const [currentPipelineId, setCurrentPipelineId] = React.useState<string>(initialPipelineId || 'default');
  // Ref to read currentPipelineId without adding it to effect dependency arrays
  // (prevents metrics/votes effects from re-running mid-animation when pipeline changes)
  const currentPipelineIdRef = React.useRef(currentPipelineId);
  React.useEffect(() => { currentPipelineIdRef.current = currentPipelineId; }, [currentPipelineId]);

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

  // Show filtered participants toggle (display mask)
  const [showFilteredParticipants, setShowFilteredParticipants] = React.useState(false);

  // Debug mode state
  const debugMode = useDebugMode();

  // Shift key temporary mode switching (spotlight is not affected by shift-key temp switching)
  const shiftKeyMode = action === "spotlight" ? "move-map" : action as "move-map" | "paint-groups";
  const { effectiveMode: _shiftEffectiveMode } = useShiftKeyTempMode({
    currentMode: shiftKeyMode,
    onModeChange: setAction as (mode: "move-map" | "paint-groups") => void
  });
  const effectiveMode = action === "spotlight" ? "spotlight" : _shiftEffectiveMode;

  // Layer mode cycling for painting in non-group modes
  const { effectiveLayerMode, cycleOpacity, startCycle, stopCycle } = useLayerModeCycling({
    currentLayerMode: layerMode,
  });

  // StatementExplorerDrawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState("all");

  // Unpainted grouping state
  const [isUnpaintedGrouped, setIsUnpaintedGrouped] = React.useState(true);

  // Clear colors dialog state
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false);

  // Download obs CSV dialog state
  const [downloadObsCsvDialogOpen, setDownloadObsCsvDialogOpen] = React.useState(false);

  // Representative statements
  const {
    representativeStatements,
    consensusStatements,
    isCalculatingRepStatements,
    repStatementsError,
    calculateRepStatements,
    clearRepStatements,
  } = useRepresentativeStatements({
    statements,
    dataset,
    pointGroups,
    currentPipelineId,
    kedroBaseUrl,
    isUnpaintedGrouped,
    drawerTab,
    setDrawerTab,
  });

  // Recompute-projection dialog + in-browser dimensional reduction
  const {
    recomputeDialogOpen,
    setRecomputeDialogOpen,
    recomputedProjections,
    druidStatus,
    druidCoords,
    druidError,
    druidProgress,
    handleRecomputeRun,
    animateIterationsRef,
  } = useRecomputeDialog({ preloadedData, dataset, currentPipelineIdRef });

  // Metrics layer
  const {
    pointMetrics,
    metricConfig,
    setMetricConfig,
    metricsType,
    obsColumnKeys,
    metricsLegendItems,
    cycleObsColumn,
  } = useMetricsLayer({ layerMode, dataset, statements, preloadedData, kedroBaseUrl, currentPipelineIdRef });


  // Update current pipeline ID when initialPipelineId prop changes
  React.useEffect(() => {
    if (initialPipelineId) {
      setCurrentPipelineId(initialPipelineId);
    }
  }, [initialPipelineId]);

  // Handle pipeline change from D3Map
  const handlePipelineChange = React.useCallback((newPipelineId: string) => {
    setCurrentPipelineId(newPipelineId);
  }, []);

  // Get current pipeline display state
  const currentDisplayState = React.useMemo(() => {
    return pipelineDisplayState[currentPipelineId] || { flipX: false, flipY: false };
  }, [pipelineDisplayState, currentPipelineId]);

  // Helper function to update display state for current pipeline
  const updatePipelineDisplayState = React.useCallback((updates: Partial<{ flipX: boolean; flipY: boolean }>) => {
    setPipelineDisplayState(prev => ({
      ...prev,
      [currentPipelineId]: {
        ...prev[currentPipelineId],
        flipX: prev[currentPipelineId]?.flipX || false,
        flipY: prev[currentPipelineId]?.flipY || false,
        ...updates
      }
    }));
  }, [currentPipelineId]);

  // Custom toggle handler that manages pipeline-specific display state
  const handleTogglesChange = React.useCallback((newToggles: string[]) => {
    // Update pipeline-specific display state based on flip toggles
    const newFlipX = newToggles.includes("flip-horizontal");
    const newFlipY = newToggles.includes("flip-vertical");

    updatePipelineDisplayState({
      flipX: newFlipX,
      flipY: newFlipY
    });

    setToggles(newToggles);
  }, [updatePipelineDisplayState]);

  // Vote stats are now calculated at StatementExplorerDrawer level for better performance
  // Removed global vote stats calculation to avoid calculating stats for all statements

  // Load data and initialize DuckDB on component mount
  React.useEffect(() => {
    const init = async () => {
      try {
        if (preloadedData) {
          // Preloaded mode: data already parsed (e.g. from h5ad file)
          console.log('Using preloaded data');

          setDataset(preloadedData.dataset);
          setStatements(preloadedData.statements);

          // Initialize DuckDB and load votes from memory
          await initializeDuckDB();
          if (preloadedData.votesRows.length > 0) {
            await loadVotesFromMemory(preloadedData.votesRows);
          }
          console.log('Preloaded data set and DuckDB initialized');
        } else if (kedroBaseUrl) {
          // Kedro mode: fetch data from Kedro API
          console.log('Loading data from Kedro API:', kedroBaseUrl);

          const [kedroData, statementsData] = await Promise.all([
            fetchAndProcessKedroData(kedroBaseUrl, initialPipelineId),
            loadStatementsData(kedroBaseUrl, initialPipelineId)
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
  }, [kedroBaseUrl, initialPipelineId, preloadedData]);

  // Synchronize toggles array with pipeline display state when pipeline changes
  React.useEffect(() => {
    // Build the expected toggles array based on current pipeline's display state
    const nonFlipToggles = toggles.filter(toggle => !toggle.startsWith('flip-'));
    const expectedToggles = [...nonFlipToggles];

    if (currentDisplayState.flipX) {
      expectedToggles.push('flip-horizontal');
    }
    if (currentDisplayState.flipY) {
      expectedToggles.push('flip-vertical');
    }

    // Check if current toggles match expected toggles
    const currentFlipToggles = toggles.filter(toggle => toggle.startsWith('flip-')).sort();
    const expectedFlipToggles = expectedToggles.filter(toggle => toggle.startsWith('flip-')).sort();

    if (JSON.stringify(currentFlipToggles) !== JSON.stringify(expectedFlipToggles)) {
      setToggles(expectedToggles);
    }
  }, [currentDisplayState, currentPipelineId]);

  const cycleStatement = React.useCallback((direction: 'prev' | 'next') => {
    if (statements.length === 0) return;
    const currentIndex = statements.findIndex(s => String(s.statement_id) === statementId);
    if (currentIndex === -1) return;
    const newIndex = direction === 'prev'
      ? (currentIndex === 0 ? statements.length - 1 : currentIndex - 1)
      : (currentIndex === statements.length - 1 ? 0 : currentIndex + 1);
    setStatementId(String(statements[newIndex].statement_id));
  }, [statements, statementId]);

  // Keyboard shortcuts for color selection and statement navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not typing in an input field
      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      // Handle left/right arrow keys for statement navigation when votes layer is active
      if (layerMode === "votes" && statements.length > 0) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          cycleStatement(event.key === 'ArrowLeft' ? 'prev' : 'next');
          event.preventDefault();
          return;
        }
      }

      // Handle left/right arrow keys for obs column cycling when metrics layer is active
      if (layerMode === "metrics" && metricConfig.type === "obs-column" && obsColumnKeys && obsColumnKeys.length > 1) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          cycleObsColumn(event.key === 'ArrowLeft' ? 'prev' : 'next');
          event.preventDefault();
          return;
        }
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
  }, [layerMode, statements, statementId, cycleStatement, metricConfig, obsColumnKeys, cycleObsColumn]);

  // Initialize point arrays when dataset is loaded
  React.useEffect(() => {
    if (dataset.length > 0) {
      setPointGroups(Array(dataset.length).fill(UNPAINTED_VALUE));
      setPointVotes(Array(dataset.length).fill(null));
    }
  }, [dataset]);

  // Load votes data when switching to votes mode or changing statement ID
  React.useEffect(() => {
    if (layerMode === "votes" && dataset.length > 0) {
      const loadVotes = async () => {
        try {
          // Use the current dataset instead of loading projections from file
          const participantIds = dataset.map(([id]) => id);
          const votes = await getVotesForParticipants(statementId, participantIds, kedroBaseUrl, currentPipelineIdRef.current);

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
  }, [layerMode, statementId, dataset, kedroBaseUrl]);

  const mode: "move" | "paint" | "spotlight" = effectiveMode === "paint-groups" ? "paint" : effectiveMode === "spotlight" ? "spotlight" : "move";

  // Spotlight statement click: toggle vote overlay for the selected statement
  const handleSpotlightStatementClick = React.useCallback(async (statementId: string) => {
    if (!dataset.length) return;
    if (activeSpotlightStatementId === statementId) {
      setActiveSpotlightStatementId(null);
      setSpotlightPointVotes([]);
      return;
    }
    setActiveSpotlightStatementId(statementId);
    const participantIds = dataset.map(([id]) => id);
    const votes = await getVotesForParticipants(statementId, participantIds, kedroBaseUrl, currentPipelineIdRef.current);
    setSpotlightPointVotes(
      dataset.map(([participantId]) => {
        switch (votes.get(participantId) ?? null) {
          case 1:  return 0;
          case -1: return 1;
          case 0:  return 2;
          default: return null;
        }
      })
    );
  }, [dataset, activeSpotlightStatementId, kedroBaseUrl]);

  // Spotlight selection handler: debounce and calculate rep statements for the hovered region
  const handleSpotlightSelectionChange = React.useCallback((ids: (string | number)[]) => {
    spotlightLatestIdsRef.current = ids;
    if (spotlightDebounceRef.current) clearTimeout(spotlightDebounceRef.current);
    spotlightDebounceRef.current = setTimeout(async () => {
      const selectedIds = spotlightLatestIdsRef.current;
      if (!dataset.length || selectedIds.length < 2) {
        setSpotlightStackItems([]);
        return;
      }
      try {
        const participants = dataset.map(([id]) => id);
        const selectedSet = new Set(selectedIds.map(String));
        const labelArray = participants.map((id) => (selectedSet.has(id) ? "0" : "1"));
        const commentTextMap = createStatementTextMap(statements);
        const result = await calculateRepresentativeStatements(labelArray, participants, commentTextMap, { maxStatementsCount: 10 });
        const top3: FinalizedCommentStats[] = result.repComments["0"]?.slice(0, 3) ?? [];
        setSpotlightStackItems(
          top3.map((stat) => ({
            id: stat.tid,
            statement: { statement_id: Number(stat.tid), txt: String(commentTextMap[stat.tid] ?? "") },
            variant: (stat.repful_for === "agree" ? "agree" : "disagree") as "agree" | "disagree",
            onClick: () => handleSpotlightStatementClick(String(stat.tid)),
          }))
        );
        setActiveSpotlightStatementId(null);
        setSpotlightPointVotes([]);
      } catch (err) {
        console.error("Spotlight rep statements error:", err);
        setSpotlightStackItems([]);
      }
    }, 400);
  }, [dataset, statements, handleSpotlightStatementClick]);

  // Vote stats calculation removed from App level - now handled in StatementExplorerDrawer
  // This avoids calculating stats for all statements when only group tab statements need them

  // Derive display mask array (parallel to dataset) from obs column
  const displayMask = React.useMemo(() => {
    if (!preloadedData?.obsColumns) return undefined;
    const maskCol = preloadedData.obsColumns[DISPLAY_MASK_COLUMN];
    if (!maskCol || maskCol.type !== 'boolean') return undefined;
    // Build map from participant ID to mask value
    const obsNames = preloadedData.dataset.map(([id]) => id);
    const maskMap = new Map<string, boolean>();
    for (let i = 0; i < obsNames.length; i++) {
      maskMap.set(obsNames[i], maskCol.values[i] === 1);
    }
    return dataset.map(([id]) => maskMap.get(id) ?? false);
  }, [preloadedData, dataset]);

  // Effective display mask: respects the "show filtered participants" toggle
  const effectiveDisplayMask = showFilteredParticipants ? undefined : displayMask;

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

    // Skip processing if no points are selected
    if (ids.length === 0) {
      return;
    }

    // Always allow painting - the cycling will show the groups layer when needed
    setPointGroups((prev) => {
      const next = [...prev];
      let hasChanges = false;

      ids.forEach((id) => {
        // find index of this id in dataset using helper function
        const idx = findDatasetIndex(dataset, id);
        if (idx !== -1 && next[idx] !== colorIndex) {
          next[idx] = colorIndex;
          hasChanges = true;
        }
      });

      // Only trigger representative statements calculation when actual changes were made
      if (hasChanges) {
        setTimeout(() => {
          calculateRepStatements(next, undefined, effectiveDisplayMask);
        }, 50);
      }

      return next;
    });
  }

  // Open clear colors dialog
  const handleOpenClearDialog = React.useCallback(() => {
    setClearDialogOpen(true);
  }, []);

  // Build a download filename with optional date prefix and conversationId
  const buildFilename = React.useCallback((base: string, ext: string, prefixDate?: boolean): string => {
    const parts = [];
    if (prefixDate) parts.push(new Date().toISOString().slice(0, 10));
    if (preloadedData?.conversationId) parts.push(preloadedData.conversationId);
    parts.push(base);
    return parts.join('-') + '.' + ext;
  }, [preloadedData?.conversationId]);

  // Escape a CSV cell value
  const escapeCsvCell = (cell: string): string => {
    const s = String(cell);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Trigger a CSV file download
  const downloadCsv = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Clear all painted colors - reset all points to unpainted
  const handleDownloadObsCsv = React.useCallback((prefixDate: boolean) => {
    const obsColumns = preloadedData?.obsColumns;
    if (!obsColumns || dataset.length === 0) return;

    const columnNames = Object.keys(obsColumns);
    const header = ['participant_id', 'manual_painted', ...columnNames];
    const rows = dataset.map(([participantId], idx) => {
      const painted = pointGroups[idx];
      const paintedValue = painted === UNPAINTED_VALUE ? '' : (PALETTE_COLOR_DEFINITIONS[painted]?.name ?? String(painted));
      const values = columnNames.map(col => {
        const val = obsColumns[col].values[idx];
        return val === null || val === undefined ? '' : String(val);
      });
      return [participantId, paintedValue, ...values];
    });

    const csvContent = [header, ...rows]
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\n');

    downloadCsv(csvContent, buildFilename('participants', 'csv', prefixDate));
  }, [dataset, pointGroups, preloadedData?.obsColumns, buildFilename]);

  // Download vote matrix CSV: rows=participants, columns=statement IDs, values=vote or empty
  const handleDownloadVoteCsv = React.useCallback(async (prefixDate: boolean) => {
    if (!preloadedData?.statements || dataset.length === 0) return;

    const statementIds = preloadedData.statements.map(s => s.statement_id);
    const allVoteRows = await getAllVotes(kedroBaseUrl, currentPipelineId === 'default' ? undefined : currentPipelineId);

    // Build lookup: participant_id → Map<comment_id, vote>
    const voteLookup = new Map<string, Map<string, number>>();
    for (const row of allVoteRows) {
      if (!voteLookup.has(row.participant_id)) {
        voteLookup.set(row.participant_id, new Map());
      }
      voteLookup.get(row.participant_id)!.set(row.comment_id, row.vote);
    }

    const header = ['participant_id', ...statementIds];
    const rows = dataset.map(([participantId]) => {
      const participantVotes = voteLookup.get(participantId);
      const values = statementIds.map(sid => {
        if (!participantVotes || !participantVotes.has(sid)) return '';
        return String(participantVotes.get(sid));
      });
      return [participantId, ...values];
    });

    const csvContent = [header, ...rows]
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\n');

    downloadCsv(csvContent, buildFilename('vote-matrix', 'csv', prefixDate));
  }, [dataset, preloadedData?.statements, kedroBaseUrl, currentPipelineId, buildFilename]);

  const handleClearAllColors = React.useCallback(() => {
    setPointGroups(Array(dataset.length).fill(UNPAINTED_VALUE));
    clearRepStatements();
    console.log('All painted colors cleared');
  }, [dataset.length, clearRepStatements]);

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

  const wasmSupported = isWebAssemblySupported();

  const lerpedCoords = useLerpedCoords(druidStatus === "running" && animateIterationsRef.current ? druidCoords : null);
  const druidLiveDataset = React.useMemo(() => {
    if (!lerpedCoords || lerpedCoords.length !== dataset.length) return undefined;
    return lerpedCoords.map((xy, i) => [dataset[i][0], xy] as [string, [number, number]]);
  }, [lerpedCoords, dataset]);

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
      className={`relative h-screen w-screen ${isCalculatingRepStatements ? 'cursor-wait' : ''}`}
      /**
       * Prevent Google Translate from modifying DOM during animations
       * which causes React "removeChild" errors when animating SVG elements
       */
      translate="no"
      data-notranslate="true"
    >
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
            liveData={druidLiveDataset}
            mode={mode === "spotlight" ? "spotlight" : mode}
            spotlightPersist={mode === "spotlight" ? true : undefined}
            onSelectionChange={mode === "spotlight" ? handleSpotlightSelectionChange : handleSelectionChange}
            pointColors={mode === "spotlight"
              ? (activeSpotlightStatementId ? spotlightPointVotes : pointGroups)
              : (effectiveLayerMode === "votes" ? pointVotes :
                 effectiveLayerMode === "metrics" ? pointMetrics : pointGroups)}
            palette={mode === "spotlight"
              ? (activeSpotlightStatementId
                  ? [VOTE_COLORS_HIGHLIGHT_PASS.agree, VOTE_COLORS_HIGHLIGHT_PASS.disagree, VOTE_COLORS_HIGHLIGHT_PASS.pass]
                  : PALETTE_COLORS)
              : (effectiveLayerMode === "votes" ?
                  (highlightPassVotes ?
                    [VOTE_COLORS_HIGHLIGHT_PASS.agree, VOTE_COLORS_HIGHLIGHT_PASS.disagree, VOTE_COLORS_HIGHLIGHT_PASS.pass] :
                    [VOTE_COLORS.agree, VOTE_COLORS.disagree, VOTE_COLORS.pass]
                  ) :
                  PALETTE_COLORS)}
            layerMode={mode === "spotlight" ? "groups" : effectiveLayerMode}
            metricsType={metricsType}
            onQuickSelect={handleQuickSelect}
            onLassoStart={handleLassoStart}
            onLassoEnd={handleLassoEnd}
            flipX={currentDisplayState.flipX}
            flipY={currentDisplayState.flipY}
            colorsToFront={colorsToFront}
            testAnimation={testAnimation || !!preloadedData?.pipelineData}
            kedroBaseUrl={kedroBaseUrl}
            pipelineFilter={pipelineFilter}
            availablePipelines={kedroBaseUrl ? [] : undefined} // Will be populated by D3Map's usePipelineOptions
            onPipelineChange={handlePipelineChange}
            preloadedPipelineData={preloadedData?.pipelineData}
            extraPipelineData={recomputedProjections}
            onRecomputeProjection={
              preloadedData?.layers && Object.keys(preloadedData.layers).length > 0
                ? () => setRecomputeDialogOpen(true)
                : undefined
            }
            onLoadFile={onLoadFile}
            onDownloadObsCsv={preloadedData?.obsColumns ? () => setDownloadObsCsvDialogOpen(true) : undefined}
            displayMask={showFilteredParticipants ? undefined : displayMask}
            unpaintedColor={isUnpaintedGrouped ? undefined : "#cccccc"}
          />
        </div>
      </div>

      {/* Reduction progress overlay */}
      {druidStatus === "running" && animateIterationsRef.current && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-1.5 min-w-48">
          {druidProgress === null ? (
            <p className="text-xs text-white bg-black/60 rounded-full px-3 py-1 animate-pulse">Building KNN graph…</p>
          ) : (
            <div className="flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${Math.round(druidProgress * 100)}%` }}
                />
              </div>
              <span className="text-xs text-white tabular-nums w-8 text-right shrink-0">
                {Math.round(druidProgress * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 z-50 pointer-events-none">
        <MapOverlay
          action={effectiveMode}
          onActionChange={setAction}
          colorIndex={colorIndex}
          onColorIndexChange={setColorIndex}
          statements={statements}
          toggles={toggles}
          onTogglesChange={handleTogglesChange}
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
          metricConfig={metricConfig}
          onMetricConfigChange={setMetricConfig}
          obsColumnKeys={obsColumnKeys}
          showFilteredParticipants={showFilteredParticipants}
          onShowFilteredParticipantsChange={setShowFilteredParticipants}
          onClearAllColors={handleOpenClearDialog}
          displayMask={effectiveDisplayMask}
          // Representative statements props
          representativeStatements={representativeStatements}
          consensusStatements={consensusStatements}
          isCalculatingRepStatements={isCalculatingRepStatements}
          repStatementsError={repStatementsError}
          isUnpaintedGrouped={isUnpaintedGrouped}
          // Debug mode props
          debugMode={debugMode}
          dataset={dataset}
          // Kedro configuration props
          kedroBaseUrl={kedroBaseUrl}
          pipelineId={currentPipelineId}
          wasmSupported={wasmSupported}
          enableSpotlight={enableSpotlight}
        />
      </div>

      {/* PointGroupBadges at the very bottom of the screen - positioned relative to screen-safe viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none" style={{ height: '100dvh', pointerEvents: 'none' }}>
        <div className="absolute bottom-0 left-0 right-0 pb-1 px-1 pointer-events-auto">
          <ParticipantCountBar
            pointGroups={pointGroups}
            isProportional={true}
            isUnpaintedGrouped={isUnpaintedGrouped}
            displayMask={effectiveDisplayMask}
            onUnpaintedGroupedChange={(newValue) => {
              setIsUnpaintedGrouped(newValue);
              // Trigger recalculation of representative statements when grouping changes
              if (pointGroups.length > 0) {
                // Use setTimeout to ensure state update has been processed
                setTimeout(() => {
                  calculateRepStatements(undefined, newValue, effectiveDisplayMask);
                }, 50);
              }
            }}
          />
        </div>
      </div>

      {/* FloatingModalV2Stack - shows rep statements in spotlight mode */}
      {action === "spotlight" && (
        <FloatingModalV2Stack items={spotlightStackItems} isVisible={spotlightStackItems.length > 0} />
      )}

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
          onPrev={() => cycleStatement('prev')}
          onNext={() => cycleStatement('next')}
        />
      )}

      {/* FloatingModal - shows annotation legend in metrics mode (obs-column) */}
      {layerMode === "metrics" && metricConfig.type === "obs-column" && (
        <FloatingModal
          title={metricConfig.column}
          legendItems={metricsLegendItems}
          isVisible={true}
          onClose={() => setLayerMode("groups")}
          onPrev={obsColumnKeys && obsColumnKeys.length > 1 ? () => cycleObsColumn('prev') : undefined}
          onNext={obsColumnKeys && obsColumnKeys.length > 1 ? () => cycleObsColumn('next') : undefined}
        />
      )}

      {/* Clear Colors Dialog */}
      <ClearColorsDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onConfirm={handleClearAllColors}
      />

      {/* Recompute Projection Dialog */}
      {preloadedData?.layers && (
        <RecomputeProjectionDialog
          open={recomputeDialogOpen}
          onOpenChange={setRecomputeDialogOpen}
          layers={preloadedData.layers}
          maskOptions={[{ value: "moderated", label: "moderated" }]}
          status={druidStatus}
          error={druidError}
          progress={druidProgress}
          onRun={handleRecomputeRun}
        />
      )}

      {/* Download Dialog */}
      <DownloadDialog
        open={downloadObsCsvDialogOpen}
        onOpenChange={setDownloadObsCsvDialogOpen}
        onConfirm={handleDownloadObsCsv}
        onConfirmVotes={preloadedData?.statements ? handleDownloadVoteCsv : undefined}
        participantCount={dataset.length}
        columnCount={Object.keys(preloadedData?.obsColumns ?? {}).length}
        statementCount={preloadedData?.statements?.length}
        conversationId={preloadedData?.conversationId}
      />
    </div>
  );
};
