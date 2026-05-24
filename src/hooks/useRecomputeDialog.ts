import { useState, useRef, useCallback, useEffect } from 'react';
import type * as React from 'react';
import { useDruidWorker } from '@/hooks/useDruidWorker';
import type { DruidWorkerStatus } from '@/hooks/useDruidWorker';
import type { ReducerAlgorithm, KnnBackend } from '@/lib/druid-reducer';
import { imputeColumnMeans, zeroMaskedColumns } from '@/lib/druid-reducer';
import type { PreloadedData } from '@/components/convo-explorer/App';

export interface UseRecomputeDialogProps {
  preloadedData?: PreloadedData;
  dataset: [string, [number, number]][];
  currentPipelineIdRef: React.MutableRefObject<string>;
}

export interface UseRecomputeDialogReturn {
  recomputeDialogOpen: boolean;
  setRecomputeDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recomputedProjections: Record<string, [string, [number, number]][]>;
  druidStatus: DruidWorkerStatus;
  druidCoords: [number, number][] | null;
  druidError: string | null;
  druidProgress: number | null;
  handleRecomputeRun: (
    layerKey: string,
    algorithm: ReducerAlgorithm,
    params: Record<string, number>,
    knnBackend?: string,
    maskColumn?: string | null,
    knnParams?: Record<string, number>,
    animateIterations?: boolean
  ) => void;
  pendingAlgorithmRef: React.MutableRefObject<ReducerAlgorithm>;
  animateIterationsRef: React.MutableRefObject<boolean>;
}

export function useRecomputeDialog(props: UseRecomputeDialogProps): UseRecomputeDialogReturn {
  const { preloadedData, dataset } = props;

  const [recomputeDialogOpen, setRecomputeDialogOpen] = useState(false);
  const [recomputedProjections, setRecomputedProjections] = useState<Record<string, [string, [number, number]][]>>({});

  const { status: druidStatus, coords: druidCoords, error: druidError, progress: druidProgress, runReduction, reset: resetDruid } = useDruidWorker();
  const pendingAlgorithmRef = useRef<ReducerAlgorithm>('umap');
  const animateIterationsRef = useRef(true);

  // Close dialog as soon as the first coords arrive (KNN graph built) when animating.
  const hasLiveCoords = druidStatus === 'running' && druidCoords !== null;
  useEffect(() => {
    if (hasLiveCoords && animateIterationsRef.current) {
      setRecomputeDialogOpen(false);
    }
  }, [hasLiveCoords]);

  // When a reduction finishes, add the result as a new selectable projection.
  useEffect(() => {
    if (druidStatus !== 'done' || !druidCoords) return;

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

  const handleRecomputeRun = useCallback(
    (
      layerKey: string,
      algorithm: ReducerAlgorithm,
      params: Record<string, number>,
      knnBackend?: string,
      maskColumn?: string | null,
      knnParams?: Record<string, number>,
      animateIterations = true
    ) => {
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
      runReduction(matrix, algorithm, params, knnBackend as KnnBackend | undefined, knnParams);
    },
    [preloadedData?.layers, preloadedData?.varNames, preloadedData?.statements, dataset, runReduction]
  );

  return {
    recomputeDialogOpen,
    setRecomputeDialogOpen,
    recomputedProjections,
    druidStatus,
    druidCoords,
    druidError,
    druidProgress,
    handleRecomputeRun,
    pendingAlgorithmRef,
    animateIterationsRef,
  };
}
