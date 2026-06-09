"use client";

import * as React from "react";
import { usePipelineOptions } from "../../.storybook/hooks/usePipelineOptions";

export type ProjectionData = [string, [number, number]][];

type PipelineOption = { id: string; name: string };

type UsePipelineManagerOptions = {
  testAnimation: boolean;
  kedroBaseUrl?: string;
  pipelineFilter?: string;
  availablePipelines?: PipelineOption[];
  preloadedPipelineData?: Record<string, ProjectionData | null>;
  extraPipelineData?: Record<string, ProjectionData>;
  onPipelineChange?: (pipelineId: string) => void;
};

type UsePipelineManagerResult = {
  pipelineData: Record<string, ProjectionData | null>;
  selectedPipeline: string;
  previousPipeline: string;
  currentPipelineOptions: PipelineOption[];
  isAnimating: boolean;
  isAutoCycling: boolean;
  onAnimationComplete: () => void;
  handlePipelineChange: (newPipeline: string) => void;
  handleTogglePipeline: () => void;
  handleAutoCycleToggle: () => void;
};

const PREFERRED_KEDRO_PIPELINE = 'mean_localmap_bestkmeans';

const STATIC_PIPELINES: PipelineOption[] = [
  { id: 'localmap', name: 'LocalMAP' },
  { id: 'pacmap', name: 'PaCMAP' },
  { id: 'umap', name: 'UMAP' },
];

export function usePipelineManager({
  testAnimation,
  kedroBaseUrl,
  pipelineFilter,
  availablePipelines = [],
  preloadedPipelineData,
  extraPipelineData,
  onPipelineChange,
}: UsePipelineManagerOptions): UsePipelineManagerResult {
  const isKedroMode = !!kedroBaseUrl;
  const isStaticMode = !isKedroMode;

  const [isAnimating, setIsAnimating] = React.useState(false);
  const [pipelineData, setPipelineData] = React.useState<Record<string, ProjectionData | null>>({});
  const [selectedPipeline, setSelectedPipeline] = React.useState<string>('');
  const [previousPipeline, setPreviousPipeline] = React.useState<string>('');
  const [isAutoCycling, setIsAutoCycling] = React.useState(false);

  // Kedro pipeline options - use internal pipeline fetching if availablePipelines not provided
  const shouldFetchKedroOptions = isKedroMode && testAnimation && !availablePipelines?.length;
  const { pipelines: fetchedKedroOptions } = usePipelineOptions(
    shouldFetchKedroOptions ? kedroBaseUrl : undefined,
    pipelineFilter || 'bestkmeans'
  );
  const kedroOptions = availablePipelines?.length ? availablePipelines : fetchedKedroOptions;

  // Preloaded pipeline options derived from preloadedPipelineData keys,
  // plus any projections recomputed in-browser
  const preloadedPipelineOptions = React.useMemo(() => {
    if (!preloadedPipelineData) return [];
    const keys = [
      ...Object.keys(preloadedPipelineData),
      ...Object.keys(extraPipelineData ?? {}),
    ];
    return keys.map(id => ({ id, name: id }));
  }, [preloadedPipelineData, extraPipelineData]);

  const currentPipelineOptions = preloadedPipelineData
    ? preloadedPipelineOptions
    : isKedroMode
    ? kedroOptions
    : STATIC_PIPELINES;

  // Initialize selectedPipeline when pipeline options become available
  React.useEffect(() => {
    if (currentPipelineOptions.length > 0 && !selectedPipeline) {
      if (preloadedPipelineData) {
        // For preloaded data, use preferred order: localmap > umap > pacmap > first key
        const preferredOrder = ['localmap', 'umap', 'pacmap'];
        const preferred = preferredOrder.find(id => id in preloadedPipelineData);
        setSelectedPipeline(preferred || currentPipelineOptions[0].id);
      } else if (isKedroMode) {
        // Prioritize preferred Kedro pipeline if available, otherwise use first
        const preferredPipeline = currentPipelineOptions.find(p => p.id === PREFERRED_KEDRO_PIPELINE);
        const defaultPipeline = preferredPipeline || currentPipelineOptions[0];
        setSelectedPipeline(defaultPipeline.id);
      } else if (testAnimation) {
        // For static projections, default to localmap
        setSelectedPipeline('localmap');
      }
    }
  }, [currentPipelineOptions, selectedPipeline, isKedroMode, testAnimation, preloadedPipelineData]);

  // Load projection data only if testAnimation is enabled
  React.useEffect(() => {
    if (!testAnimation) return;

    // If preloaded pipeline data is provided, use it directly
    // (merged with any projections recomputed in-browser)
    if (preloadedPipelineData) {
      setPipelineData({ ...preloadedPipelineData, ...extraPipelineData });
      return;
    }

    const loadProjections = async () => {
      try {
        if (isKedroMode && kedroOptions.length > 0) {
          const { fetchAndProcessKedroData } = await import('../lib/kedro-api');
          const dataMap: Record<string, ProjectionData | null> = {};

          for (const pipeline of kedroOptions) {
            try {
              const data = await fetchAndProcessKedroData(kedroBaseUrl!, pipeline.id);
              dataMap[pipeline.id] = data;
            } catch (error) {
              console.error(`Failed to load pipeline ${pipeline.id}:`, error);
              dataMap[pipeline.id] = null;
            }
          }

          setPipelineData(dataMap);
        } else if (isStaticMode) {
          const [localmapResponse, pacmapResponse, umapResponse] = await Promise.all([
            fetch('/projections.json'),
            fetch('/projections.mean-pacmap.json'),
            fetch('/projections.mean-umap.json')
          ]);

          const [localmapData, pacmapData, umapData] = await Promise.all([
            localmapResponse.json(),
            pacmapResponse.json(),
            umapResponse.json()
          ]);

          const sortByParticipantId = (data: ProjectionData) =>
            data.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

          setPipelineData({
            localmap: sortByParticipantId([...localmapData]),
            pacmap: sortByParticipantId([...pacmapData]),
            umap: sortByParticipantId([...umapData]),
          });
        }
      } catch (error) {
        console.error('Failed to load projection data:', error);
      }
    };

    loadProjections();
  }, [testAnimation, isKedroMode, isStaticMode, kedroOptions, preloadedPipelineData, extraPipelineData]);

  // Auto-select a freshly recomputed projection when it first appears
  const prevExtraKeysRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    const keys = Object.keys(extraPipelineData ?? {});
    const added = keys.find(k => !prevExtraKeysRef.current.includes(k));
    prevExtraKeysRef.current = keys;
    if (added) {
      setSelectedPipeline(prev => {
        setPreviousPipeline(prev);
        return added;
      });
      onPipelineChange?.(added);
    }
  }, [extraPipelineData, onPipelineChange]);

  const handlePipelineChange = React.useCallback((newPipeline: string) => {
    if (!testAnimation || !pipelineData[newPipeline] || isAnimating || newPipeline === selectedPipeline) return;

    setIsAnimating(true);
    setPreviousPipeline(selectedPipeline);
    setSelectedPipeline(newPipeline);

    onPipelineChange?.(newPipeline);
  }, [testAnimation, pipelineData, isAnimating, selectedPipeline, onPipelineChange]);

  const handleTogglePipeline = React.useCallback(() => {
    if (!testAnimation || !previousPipeline || !pipelineData[previousPipeline] || isAnimating) return;
    setIsAnimating(true);
    const temp = selectedPipeline;
    setSelectedPipeline(previousPipeline);
    setPreviousPipeline(temp);

    onPipelineChange?.(previousPipeline);
  }, [testAnimation, previousPipeline, pipelineData, isAnimating, selectedPipeline, onPipelineChange]);

  // Auto-cycling logic - trigger next cycle when animation completes
  React.useEffect(() => {
    if (isAutoCycling && previousPipeline && !isAnimating) {
      const timeoutId = setTimeout(() => {
        handleTogglePipeline();
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [isAutoCycling, previousPipeline, isAnimating, handleTogglePipeline]);

  const handleAutoCycleToggle = React.useCallback(() => {
    if (isAutoCycling) {
      setIsAutoCycling(false);
    } else {
      if (previousPipeline && pipelineData[previousPipeline]) {
        setIsAutoCycling(true);
      }
    }
  }, [isAutoCycling, previousPipeline, pipelineData]);

  const onAnimationComplete = React.useCallback(() => {
    setIsAnimating(false);
  }, []);

  return {
    pipelineData,
    selectedPipeline,
    previousPipeline,
    currentPipelineOptions,
    isAnimating,
    isAutoCycling,
    onAnimationComplete,
    handlePipelineChange,
    handleTogglePipeline,
    handleAutoCycleToggle,
  };
}
