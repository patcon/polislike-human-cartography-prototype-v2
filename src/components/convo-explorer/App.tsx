"use client";

import * as React from "react";
import { D3Map } from "./D3Map";
import { MapOverlay } from "./MapOverlay";
import { ParticipantCountBar } from "./ParticipantCountBar";
import { ClearColorsDialog } from "./ClearColorsDialog";
import { DownloadDialog } from "./DownloadDialog";
import { FloatingModal } from "./FloatingModal";
import { INITIAL_ACTION, PALETTE_COLOR_DEFINITIONS, PALETTE_COLORS, VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS, UNPAINTED_VALUE, DISPLAY_MASK_COLUMN } from "@/constants";
import { resolveAssetPath, getAssetUrl } from "../../lib/paths";
import { AnnDataStore, getAnnDataStore, setAnnDataStore } from "../../lib/anndata-store";
import { readVoteParquet } from "../../lib/parquet-reader";
import { isWebAssemblySupported } from "../../lib/wasm-detect";
import { Spinner } from "../ui/spinner";
import {
  calculateRepresentativeStatements,
  createStatementTextMap,
  getLabelArrayWithOptionalUngrouped,
} from "../../lib/representative-statements";
import type { FinalizedCommentStats, ConsensusStatement } from "@/lib/stats";
import { fetchAndProcessKedroData, loadStatementsData, getVotesParquetPath, getPrincipalComponentValues } from "@/lib/kedro-api";
import { useDebugMode } from "../../hooks/useDebugMode";
import { useShiftKeyTempMode } from "../../hooks/useShiftKeyTempMode";
import { useLayerModeCycling } from "../../hooks/useLayerModeCycling";
import type { MetricConfig } from "./MetricsLayerConfig";
import type { ObsColumnType } from "@/lib/color-schemes";
import { getAnnotationCategoricalColor } from "@/lib/color-schemes";
import type { ObsColumnInfo, LayerMatrix } from "@/lib/h5ad-loader";
import { useDruidWorker } from "@/hooks/useDruidWorker";
import { useLerpedCoords } from "@/hooks/useLerpedCoords";
import type { ReducerAlgorithm } from "@/lib/druid-reducer";
import { imputeColumnMeans, zeroMaskedColumns } from "@/lib/druid-reducer";
import { RecomputeProjectionDialog } from "./RecomputeProjectionDialog";

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
};

export const App: React.FC<AppProps> = ({ testAnimation = false, kedroBaseUrl, initialPipelineId, pipelineFilter, preloadedData, onLoadFile }) => {
  const [dataset, setDataset] = React.useState<[string, [number, number]][]>([]);
  const [statements, setStatements] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [, setSelectedIds] = React.useState<number[]>([]);
  const [action, setAction] = React.useState<"move-map" | "paint-groups">(INITIAL_ACTION);

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

  // array parallel to dataset: metrics values 0-1 (for metrics mode)
  const [pointMetrics, setPointMetrics] = React.useState<(number | null)[]>([]);

  // Metric configuration state
  const [metricConfig, setMetricConfig] = React.useState<MetricConfig>({ type: "vote-count", style: "color" });

  // Show filtered participants toggle (display mask)
  const [showFilteredParticipants, setShowFilteredParticipants] = React.useState(false);

  // Type of the current metric (drives color scheme in D3Map)
  const [metricsType, setMetricsType] = React.useState<ObsColumnType>('continuous');

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

  // Download obs CSV dialog state
  const [downloadObsCsvDialogOpen, setDownloadObsCsvDialogOpen] = React.useState(false);

  // Recompute-projection dialog + in-browser dimensional reduction state
  const [recomputeDialogOpen, setRecomputeDialogOpen] = React.useState(false);
  const [recomputedProjections, setRecomputedProjections] = React.useState<Record<string, [string, [number, number]][]>>({});
  const { status: druidStatus, coords: druidCoords, error: druidError, progress: druidProgress, runReduction, reset: resetDruid } = useDruidWorker();
  const pendingAlgorithmRef = React.useRef<ReducerAlgorithm>("umap");
  const animateIterationsRef = React.useRef(true);

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

  // Helper: sort statements by ID (integer then string fallback)
  type StatementRow = { statement_id: string; txt: string; moderated: number };
  const sortStatements = (arr: StatementRow[]): StatementRow[] =>
    [...arr].sort((a, b) => {
      const aInt = parseInt(String(a.statement_id), 10);
      const bInt = parseInt(String(b.statement_id), 10);
      if (!isNaN(aInt) && !isNaN(bInt)) return aInt - bInt;
      return String(a.statement_id).localeCompare(String(b.statement_id));
    });

  // Load data and initialise in-memory AnnDataStore on component mount
  React.useEffect(() => {
    const init = async () => {
      try {
        if (preloadedData) {
          // h5ad mode: AnnDataStore was built by the file loader in showcase-lander.
          // Fall back to building from preloadedData (e.g. Storybook stories).
          if (!getAnnDataStore()) {
            const store = AnnDataStore.fromRawData({
              obsNames: preloadedData.dataset.map(([id]) => id),
              varNames: preloadedData.varNames ?? preloadedData.statements.map(s => String(s.statement_id)),
              voteRows: preloadedData.votesRows ?? [],
              statements: preloadedData.statements,
              obsColumns: preloadedData.obsColumns,
              obsm: preloadedData.pipelineData
                ? Object.fromEntries(Object.entries(preloadedData.pipelineData).map(([k, v]) => [k, v.map(([, c]) => c)]))
                : {},
              fullDimensionObsm: preloadedData.fullDimensionEmbeddings
                ? Object.fromEntries(Object.entries(preloadedData.fullDimensionEmbeddings).map(([k, v]) => [k, v.map(([, c]) => c)]))
                : {},
              layers: preloadedData.layers,
              conversationId: preloadedData.conversationId,
            });
            setAnnDataStore(store);
          }
          setDataset(preloadedData.dataset);
          setStatements(preloadedData.statements);
        } else if (kedroBaseUrl) {
          // Kedro mode: fetch projections + statements + votes parquet → AnnDataStore
          const [kedroData, statementsData] = await Promise.all([
            fetchAndProcessKedroData(kedroBaseUrl, initialPipelineId),
            loadStatementsData(kedroBaseUrl, initialPipelineId),
          ]);

          const sortedStatements = sortStatements(statementsData as StatementRow[]);
          const obsNames = kedroData.map(([id]: [string, [number, number]]) => id);
          const varNames = sortedStatements.map(s => String(s.statement_id));

          let voteRows: { participant_id: string; comment_id: string; vote: number }[] = [];
          try {
            const parquetPath = await getVotesParquetPath(kedroBaseUrl, initialPipelineId);
            voteRows = await readVoteParquet(`${kedroBaseUrl}/${parquetPath}`);
          } catch (err) {
            console.warn('Could not load votes parquet from Kedro:', err);
          }

          const pipelineKey = initialPipelineId ?? 'default';
          const store = AnnDataStore.fromRawData({
            obsNames,
            varNames,
            voteRows,
            statements: sortedStatements,
            obsm: { [pipelineKey]: kedroData.map(([, c]: [string, [number, number]]) => c) },
          });
          setAnnDataStore(store);
          setDataset(kedroData);
          setStatements(sortedStatements);
        } else {
          // Local mode: load projections.json + statements.json + votes.parquet → AnnDataStore
          const [projectionsResponse, statementsResponse] = await Promise.all([
            fetch(resolveAssetPath('/projections.json')),
            fetch(resolveAssetPath('/statements.json')),
          ]);

          const projectionsData: [string, [number, number]][] = await projectionsResponse.json();
          const statementsData = await statementsResponse.json();

          const sortedProjections = [...projectionsData].sort(
            (a, b) => parseInt(String(a[0])) - parseInt(String(b[0]))
          );
          const sortedStatements = sortStatements(statementsData as StatementRow[]);
          const obsNames = sortedProjections.map(([id]) => id);
          const varNames = sortedStatements.map(s => String(s.statement_id));

          let voteRows: { participant_id: string; comment_id: string; vote: number }[] = [];
          try {
            voteRows = await readVoteParquet(getAssetUrl('/votes.parquet'));
          } catch (err) {
            console.warn('Could not load local votes.parquet:', err);
          }

          const store = AnnDataStore.fromRawData({
            obsNames,
            varNames,
            voteRows,
            statements: sortedStatements,
            obsm: { default: sortedProjections.map(([, c]) => c) },
          });
          setAnnDataStore(store);
          setDataset(sortedProjections);
          setStatements(sortedStatements);
        }

        setLoading(false);
      } catch (err) {
        console.error('Data loading error:', err);
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

  // Derive obs column keys from the store for the "Other" metrics option
  // Exclude the display mask column so it doesn't appear in the dropdown
  const obsColumnKeys = React.useMemo(() => {
    const store = getAnnDataStore();
    if (!store || Object.keys(store.obsColumns).length === 0) return undefined;
    const keys = Object.keys(store.obsColumns).filter(k => k !== DISPLAY_MASK_COLUMN);
    return keys.length > 0 ? keys : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]); // re-derive when dataset changes (new store loaded)

  const cycleObsColumn = React.useCallback((direction: 'prev' | 'next') => {
    if (!obsColumnKeys || obsColumnKeys.length === 0) return;
    if (metricConfig.type !== 'obs-column') return;
    const currentIndex = obsColumnKeys.indexOf(metricConfig.column);
    if (currentIndex === -1) return;
    const newIndex = direction === 'prev'
      ? (currentIndex === 0 ? obsColumnKeys.length - 1 : currentIndex - 1)
      : (currentIndex === obsColumnKeys.length - 1 ? 0 : currentIndex + 1);
    setMetricConfig({ type: 'obs-column', column: obsColumnKeys[newIndex] });
  }, [obsColumnKeys, metricConfig]);

  // Derive legend items for the metrics FloatingModal (categorical columns only)
  const metricsLegendItems = React.useMemo(() => {
    if (metricConfig.type !== 'obs-column') return undefined;
    const store = getAnnDataStore();
    if (!store) return undefined;
    const columnInfo = store.obsColumns[metricConfig.column];
    if (!columnInfo || columnInfo.type !== 'categorical') return undefined;
    const categories = columnInfo.categories ?? [];
    // Hide legend when there are too many categories to be useful
    if (categories.length > 65) return undefined;
    return categories.map((cat, i) => ({
      label: String(cat),
      color: getAnnotationCategoricalColor(i),
    }));
  }, [metricConfig, preloadedData?.obsColumns]);

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
      setPointMetrics(Array(dataset.length).fill(null));
    }
  }, [dataset]);

  // Load votes data when switching to votes mode or changing statement ID
  React.useEffect(() => {
    if (layerMode === "votes" && dataset.length > 0) {
      const store = getAnnDataStore();
      if (!store) return;

      const participantIds = dataset.map(([id]) => id);
      const votes = store.getVotesForStatement(statementId, participantIds);

      const newPointVotes = dataset.map(([participantId]) => {
        const vote = votes.get(participantId) ?? null;
        if (vote === null) return null;
        switch (vote) {
          case 1: return 0;    // agree - green
          case -1: return 1;   // disagree - red
          case 0: return 2;    // pass - yellow
          default: return null;
        }
      });

      setPointVotes(newPointVotes);
    }
  }, [layerMode, statementId, dataset]);

  // Load metrics data when switching to metrics mode or when metric config changes
  React.useEffect(() => {
    if (layerMode === "metrics" && dataset.length > 0) {
      const loadMetrics = async () => {
        try {
          if (metricConfig.type === "vote-count") {
            setMetricsType('continuous');

            const store = getAnnDataStore();
            if (!store) return;

            const nonModeratedIds = statements.length > 0
              ? statements.filter(s => s.moderated !== -1).map(s => String(s.statement_id))
              : undefined;

            const voteCounts = store.getVoteCountsForAllParticipants({ statementIds: nonModeratedIds });

            const newPointMetrics = dataset.map(([participantId]) => {
              return voteCounts.get(participantId) ?? null;
            });

            setPointMetrics(newPointMetrics);
          } else if (metricConfig.type === "obs-column") {
            // Load obs column metrics from the store's obsColumns
            const obsColStore = getAnnDataStore();
            if (obsColStore?.obsColumns) {
              const columnInfo = obsColStore.obsColumns[metricConfig.column];
              if (columnInfo) {
                setMetricsType(columnInfo.type);

                const obsNames = obsColStore.obsNames;
                const valueMap = new Map<string, string | number | null>();
                for (let i = 0; i < obsNames.length; i++) {
                  if (i < columnInfo.values.length) {
                    valueMap.set(obsNames[i], columnInfo.values[i]);
                  }
                }

                if (columnInfo.type === 'boolean') {
                  // Boolean: true(1)→1, false(0)→0, null→null
                  const newPointMetrics = dataset.map(([participantId]) => {
                    const raw = valueMap.get(participantId);
                    if (raw === null || raw === undefined) return null;
                    return Number(raw) ? 1 : 0;
                  });
                  setPointMetrics(newPointMetrics);
                } else if (columnInfo.type === 'categorical') {
                  // Categorical: map value to its index in categories array
                  const categories = columnInfo.categories ?? [];
                  const categoryIndex = new Map(categories.map((c, i) => [String(c), i]));

                  const newPointMetrics = dataset.map(([participantId]) => {
                    const raw = valueMap.get(participantId);
                    if (raw === null || raw === undefined) return null;
                    return categoryIndex.get(String(raw)) ?? null;
                  });
                  setPointMetrics(newPointMetrics);
                } else {
                  // Continuous: min-max normalize to 0-1
                  const numericValues: number[] = [];
                  for (const v of columnInfo.values) {
                    if (v !== null && typeof v === 'number' && !isNaN(v)) {
                      numericValues.push(v);
                    }
                  }
                  const min = numericValues.length > 0 ? Math.min(...numericValues) : 0;
                  const max = numericValues.length > 0 ? Math.max(...numericValues) : 1;
                  const range = max - min;

                  const newPointMetrics = dataset.map(([participantId]) => {
                    const raw = valueMap.get(participantId);
                    if (raw === null || raw === undefined) return null;
                    const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
                    if (isNaN(num)) return null;
                    return range > 0 ? (num - min) / range : 0.5;
                  });
                  setPointMetrics(newPointMetrics);
                }
              }
            }
          } else if (metricConfig.type === "principal-components") {
            setMetricsType('continuous');
            // Load principal component metrics
            const componentIndex = metricConfig.component - 1; // Convert 1-based to 0-based index

            const pcaStore = getAnnDataStore();
            if (pcaStore && Object.keys(pcaStore.fullDimensionObsm).length > 0) {
              // Extract components from the store's full-dimension embeddings
              const embKeys = Object.keys(pcaStore.fullDimensionObsm);
              const pcaKey = embKeys.find(k => k === 'pca_masked_unscaled')
                || embKeys.find(k => k.includes('pca'))
                || embKeys[0];

              if (pcaKey) {
                const fullCoords = pcaStore.fullDimensionObsm[pcaKey];
                const rawValues = new Map<string, number>();
                let minValue = Infinity;
                let maxValue = -Infinity;

                pcaStore.obsNames.forEach((pid, i) => {
                  const coords = fullCoords[i];
                  if (coords && coords.length > componentIndex) {
                    const value = coords[componentIndex];
                    rawValues.set(pid, value);
                    minValue = Math.min(minValue, value);
                    maxValue = Math.max(maxValue, value);
                  }
                });

                const range = maxValue - minValue;
                const newPointMetrics = dataset.map(([participantId]) => {
                  const raw = rawValues.get(participantId);
                  if (raw === undefined) return null;
                  return range > 0 ? (raw - minValue) / range : 0.5;
                });
                setPointMetrics(newPointMetrics);
              }
            } else {
              // Kedro/static mode: derive PCA pipeline ID from current pipeline
              const pipelineParts = currentPipelineIdRef.current.split('_');
              let pcaPipelineId = 'mean_pca_bestkmeans'; // fallback default

              if (pipelineParts.length >= 3) {
                const imputer = pipelineParts[0]; // e.g., "mean", "median"
                const clustering = "bestkmeans";
                pcaPipelineId = `${imputer}_pca_${clustering}`;
              }

              console.log(`Using PCA pipeline "${pcaPipelineId}" derived from current pipeline "${currentPipelineIdRef.current}"`);

              const componentValues = await getPrincipalComponentValues(componentIndex, {
                kedroBaseUrl,
                pipelineId: pcaPipelineId
              });

              const newPointMetrics = dataset.map(([participantId]) => {
                return componentValues.get(participantId) ?? null;
              });

              setPointMetrics(newPointMetrics);
            }
          }
        } catch (err) {
          console.error('Error loading metrics:', err);
        }
      };

      loadMetrics();
    }
  }, [layerMode, dataset, kedroBaseUrl, statements, metricConfig, preloadedData]);

  const mode: "move" | "paint" = effectiveMode === "paint-groups" ? "paint" : "move";

  // Calculate representative statements (sync — no DuckDB required)
  const calculateRepStatements = React.useCallback((updatedPointGroups?: number[], updatedIsUnpaintedGrouped?: boolean, mask?: boolean[]) => {
    if (isCalculatingRepStatements) return;

    const groupsToAnalyze = updatedPointGroups || pointGroups;
    const unpaintedGroupedToUse = updatedIsUnpaintedGrouped !== undefined ? updatedIsUnpaintedGrouped : isUnpaintedGrouped;
    const statementTextMap = createStatementTextMap(statements);
    const labelArray = getLabelArrayWithOptionalUngrouped(groupsToAnalyze, unpaintedGroupedToUse, mask);

    const uniqueGroups = new Set(labelArray.filter(label => label !== null));
    if (uniqueGroups.size < 2) {
      setRepresentativeStatements({});
      setConsensusStatements(null);
      setRepStatementsError(null);
      if (drawerTab !== "all") setDrawerTab("all");
      return;
    }

    setIsCalculatingRepStatements(true);
    setRepStatementsError(null);

    try {
      const participants = dataset.map(([participantId]) => participantId);
      const result = calculateRepresentativeStatements(
        labelArray,
        participants,
        statementTextMap,
        { includeModerated: false, minVoteCount: 1, maxStatementsCount: 10 }
      );
      setRepresentativeStatements(result.repComments);
      setConsensusStatements(result.consensusStatements);
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

  // Derive display mask array (parallel to dataset) from the store's obs column
  const displayMask = React.useMemo(() => {
    const store = getAnnDataStore();
    if (!store) return undefined;
    const maskCol = store.obsColumns[DISPLAY_MASK_COLUMN];
    if (!maskCol || maskCol.type !== 'boolean') return undefined;
    const maskMap = new Map<string, boolean>();
    store.obsNames.forEach((pid, i) => {
      maskMap.set(pid, maskCol.values[i] === 1);
    });
    return dataset.map(([id]) => maskMap.get(id) ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]); // re-derive when dataset changes (new store loaded)

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
    const conversationId = getAnnDataStore()?.conversationId ?? preloadedData?.conversationId;
    if (conversationId) parts.push(conversationId);
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

  // Download participants CSV from store (obs columns + painted groups)
  const handleDownloadObsCsv = React.useCallback((prefixDate: boolean) => {
    const store = getAnnDataStore();
    if (!store || dataset.length === 0) return;

    const obsColumns = store.obsColumns;
    const columnNames = Object.keys(obsColumns);
    const header = ['participant_id', 'manual_painted', ...columnNames];
    const obsIdx = new Map(store.obsNames.map((id, i) => [id, i]));
    const rows = dataset.map(([participantId], idx) => {
      const painted = pointGroups[idx];
      const paintedValue = painted === UNPAINTED_VALUE ? '' : (PALETTE_COLOR_DEFINITIONS[painted]?.name ?? String(painted));
      const storeRow = obsIdx.get(participantId);
      const values = columnNames.map(col => {
        const val = storeRow !== undefined ? obsColumns[col].values[storeRow] : null;
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
  const handleDownloadVoteCsv = React.useCallback((prefixDate: boolean) => {
    const store = getAnnDataStore();
    if (!store || dataset.length === 0) return;

    const allVoteRows = store.getAllVoteRows();
    const statementIds = store.varNames;

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
  }, [dataset, buildFilename]);

  // Download h5ad file — merges current painted groups into obs before serialising
  const handleDownloadH5ad = React.useCallback(async (prefixDate: boolean) => {
    const store = getAnnDataStore();
    if (!store) return;
    const bytes = await store.toH5adBytes(pointGroups.length > 0 ? pointGroups : undefined);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildFilename('data', 'h5ad', prefixDate);
    link.click();
    URL.revokeObjectURL(url);
  }, [pointGroups, buildFilename]);

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

  // Reshape a selected layer matrix and kick off in-browser dimensional reduction
  const handleRecomputeRun = React.useCallback(
    (layerKey: string, algorithm: ReducerAlgorithm, params: Record<string, number>, knnBackend: string | undefined, maskColumn: string | null, knnParams?: Record<string, number>, animateIterations = true) => {
      const layer = preloadedData?.layers?.[layerKey];
      if (!layer) return;
      const [nObs, nVars] = layer.shape;
      if (nObs !== dataset.length) {
        console.error(
          `Layer "${layerKey}" has ${nObs} rows but the dataset has ${dataset.length} participants.`
        );
        return;
      }
      const matrix: number[][] = [];
      for (let i = 0; i < nObs; i++) {
        const row = new Array<number>(nVars);
        for (let j = 0; j < nVars; j++) {
          row[j] = layer.data[i * nVars + j];
        }
        matrix.push(row);
      }

      imputeColumnMeans(matrix);

      // Column mask: zero out columns whose var metadata value is truthy.
      if (maskColumn && preloadedData?.varNames) {
        const stmtByVarId = new Map(
          preloadedData.statements.map((s) => [s.statement_id, s])
        );
        const mask = preloadedData.varNames.map((id) => {
          const stmt = stmtByVarId.get(id);
          return !!(stmt && (stmt as Record<string, unknown>)[maskColumn]);
        });
        zeroMaskedColumns(matrix, mask);
      }

      pendingAlgorithmRef.current = algorithm;
      animateIterationsRef.current = animateIterations;
      runReduction(matrix, algorithm, params, knnBackend as import("@/lib/druid-reducer").KnnBackend | undefined, knnParams);
    },
    [preloadedData?.layers, preloadedData?.varNames, preloadedData?.statements, dataset, runReduction]
  );

  // Close dialog as soon as the first coords arrive (KNN graph built) when animating.
  const hasLiveCoords = druidStatus === "running" && druidCoords !== null;
  React.useEffect(() => {
    if (hasLiveCoords && animateIterationsRef.current) {
      setRecomputeDialogOpen(false);
    }
  }, [hasLiveCoords]);

  // When a reduction finishes, add the result as a new selectable projection.
  React.useEffect(() => {
    if (druidStatus !== "done" || !druidCoords) return;

    const obsNames = dataset.map(([id]) => id);
    const projection = druidCoords.map(
      (xy, i) => [obsNames[i], xy] as [string, [number, number]]
    );

    setRecomputedProjections((prev) => {
      const taken = new Set([
        ...Object.keys(prev),
        ...Object.keys(preloadedData?.pipelineData ?? {}),
      ]);
      const base = `${pendingAlgorithmRef.current}-recomputed`;
      let key = base;
      let n = 2;
      while (taken.has(key)) {
        key = `${base}-${n++}`;
      }
      return { ...prev, [key]: projection };
    });

    if (!animateIterationsRef.current) setRecomputeDialogOpen(false);
    resetDruid();
  }, [druidStatus, druidCoords, dataset, preloadedData?.pipelineData, resetDruid]);

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
            metricsType={metricsType}
            onSelectionChange={handleSelectionChange}
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
            onDownloadObsCsv={() => setDownloadObsCsvDialogOpen(true)}
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
          wasmSupported={wasmSupported}
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
        onConfirmVotes={statements.length > 0 ? handleDownloadVoteCsv : undefined}
        onConfirmH5ad={handleDownloadH5ad}
        participantCount={dataset.length}
        columnCount={Object.keys(getAnnDataStore()?.obsColumns ?? {}).length}
        statementCount={statements.length || undefined}
        conversationId={getAnnDataStore()?.conversationId ?? preloadedData?.conversationId}
      />
    </div>
  );
};
