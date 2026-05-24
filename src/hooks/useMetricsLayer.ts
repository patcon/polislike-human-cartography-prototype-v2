import { useState, useMemo, useCallback, useEffect } from 'react';
import type * as React from 'react';
import { getVoteCountsForAllParticipants, getNonModeratedStatementIds } from '@/lib/duckdb';
import { getPrincipalComponentValues } from '@/lib/kedro-api';
import { DISPLAY_MASK_COLUMN } from '@/constants';
import { getAnnotationCategoricalColor } from '@/lib/color-schemes';
import type { MetricConfig } from '@/components/convo-explorer/MetricsLayerConfig';
import type { ObsColumnType } from '@/lib/color-schemes';
import type { PreloadedData } from '@/components/convo-explorer/App';

export interface UseMetricsLayerProps {
  layerMode: 'groups' | 'votes' | 'metrics';
  dataset: [string, [number, number]][];
  statements: any[];
  preloadedData?: PreloadedData;
  kedroBaseUrl?: string;
  currentPipelineIdRef: React.MutableRefObject<string>;
}

export interface UseMetricsLayerReturn {
  pointMetrics: (number | null)[];
  metricConfig: MetricConfig;
  setMetricConfig: React.Dispatch<React.SetStateAction<MetricConfig>>;
  metricsType: ObsColumnType;
  obsColumnKeys: string[] | undefined;
  metricsLegendItems: { label: string; color: string }[] | undefined;
  cycleObsColumn: (direction: 'prev' | 'next') => void;
}

export function useMetricsLayer(props: UseMetricsLayerProps): UseMetricsLayerReturn {
  const { layerMode, dataset, statements, preloadedData, kedroBaseUrl, currentPipelineIdRef } = props;

  const [pointMetrics, setPointMetrics] = useState<(number | null)[]>([]);
  const [metricConfig, setMetricConfig] = useState<MetricConfig>({ type: 'vote-count', style: 'color' });
  const [metricsType, setMetricsType] = useState<ObsColumnType>('continuous');

  // Initialize pointMetrics array when dataset loads or changes
  useEffect(() => {
    if (dataset.length > 0) {
      setPointMetrics(Array(dataset.length).fill(null));
    }
  }, [dataset]);

  const obsColumnKeys = useMemo(() => {
    if (!preloadedData?.obsColumns) return undefined;
    const keys = Object.keys(preloadedData.obsColumns).filter(k => k !== DISPLAY_MASK_COLUMN);
    return keys.length > 0 ? keys : undefined;
  }, [preloadedData?.obsColumns]);

  const cycleObsColumn = useCallback((direction: 'prev' | 'next') => {
    if (!obsColumnKeys || obsColumnKeys.length === 0) return;
    if (metricConfig.type !== 'obs-column') return;
    const currentIndex = obsColumnKeys.indexOf(metricConfig.column);
    if (currentIndex === -1) return;
    const newIndex = direction === 'prev'
      ? (currentIndex === 0 ? obsColumnKeys.length - 1 : currentIndex - 1)
      : (currentIndex === obsColumnKeys.length - 1 ? 0 : currentIndex + 1);
    setMetricConfig({ type: 'obs-column', column: obsColumnKeys[newIndex] });
  }, [obsColumnKeys, metricConfig]);

  const metricsLegendItems = useMemo(() => {
    if (metricConfig.type !== 'obs-column') return undefined;
    if (!preloadedData?.obsColumns) return undefined;
    const columnInfo = preloadedData.obsColumns[metricConfig.column];
    if (!columnInfo || columnInfo.type !== 'categorical') return undefined;
    const categories = columnInfo.categories ?? [];
    if (categories.length > 65) return undefined;
    return categories.map((cat, i) => ({
      label: String(cat),
      color: getAnnotationCategoricalColor(i),
    }));
  }, [metricConfig, preloadedData?.obsColumns]);

  // Load metrics data when switching to metrics mode or when metric config changes
  useEffect(() => {
    if (layerMode !== 'metrics' || dataset.length === 0) return;

    const loadMetrics = async () => {
      try {
        if (metricConfig.type === 'vote-count') {
          setMetricsType('continuous');

          const EXCLUDE_MODERATED_STATEMENTS = true;
          let statementIds: string[] | undefined;

          if (EXCLUDE_MODERATED_STATEMENTS && statements.length > 0) {
            statementIds = getNonModeratedStatementIds(statements);
          }

          const voteCounts = await getVoteCountsForAllParticipants({
            kedroBaseUrl,
            pipelineId: currentPipelineIdRef.current,
            statementIds,
          });

          const newPointMetrics = dataset.map(([participantId]) => {
            return voteCounts.get(participantId) ?? null;
          });

          setPointMetrics(newPointMetrics);
        } else if (metricConfig.type === 'obs-column') {
          if (preloadedData?.obsColumns) {
            const columnInfo = preloadedData.obsColumns[metricConfig.column];
            if (columnInfo) {
              setMetricsType(columnInfo.type);

              const obsNames = preloadedData.dataset.map(([id]) => id);
              const valueMap = new Map<string, string | number | null>();
              for (let i = 0; i < obsNames.length; i++) {
                if (i < columnInfo.values.length) {
                  valueMap.set(obsNames[i], columnInfo.values[i]);
                }
              }

              if (columnInfo.type === 'boolean') {
                const newPointMetrics = dataset.map(([participantId]) => {
                  const raw = valueMap.get(participantId);
                  if (raw === null || raw === undefined) return null;
                  return Number(raw) ? 1 : 0;
                });
                setPointMetrics(newPointMetrics);
              } else if (columnInfo.type === 'categorical') {
                const categories = columnInfo.categories ?? [];
                const categoryIndex = new Map(categories.map((c, i) => [String(c), i]));

                const newPointMetrics = dataset.map(([participantId]) => {
                  const raw = valueMap.get(participantId);
                  if (raw === null || raw === undefined) return null;
                  return categoryIndex.get(String(raw)) ?? null;
                });
                setPointMetrics(newPointMetrics);
              } else {
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
        } else if (metricConfig.type === 'principal-components') {
          setMetricsType('continuous');
          const componentIndex = metricConfig.component - 1;

          if (preloadedData?.fullDimensionEmbeddings) {
            const embKeys = Object.keys(preloadedData.fullDimensionEmbeddings);
            const pcaKey = embKeys.find(k => k === 'pca_masked_unscaled')
              || embKeys.find(k => k.includes('pca'))
              || embKeys[0];

            if (pcaKey) {
              const fullData = preloadedData.fullDimensionEmbeddings[pcaKey];
              const rawValues = new Map<string, number>();
              let minValue = Infinity;
              let maxValue = -Infinity;

              for (const [pid, coords] of fullData) {
                if (coords.length > componentIndex) {
                  const value = coords[componentIndex];
                  rawValues.set(pid, value);
                  minValue = Math.min(minValue, value);
                  maxValue = Math.max(maxValue, value);
                }
              }

              const range = maxValue - minValue;
              const newPointMetrics = dataset.map(([participantId]) => {
                const raw = rawValues.get(participantId);
                if (raw === undefined) return null;
                return range > 0 ? (raw - minValue) / range : 0.5;
              });

              setPointMetrics(newPointMetrics);
            }
          } else {
            const pipelineParts = currentPipelineIdRef.current.split('_');
            let pcaPipelineId = 'mean_pca_bestkmeans';

            if (pipelineParts.length >= 3) {
              const imputer = pipelineParts[0];
              const clustering = 'bestkmeans';
              pcaPipelineId = `${imputer}_pca_${clustering}`;
            }

            const componentValues = await getPrincipalComponentValues(componentIndex, {
              kedroBaseUrl,
              pipelineId: pcaPipelineId,
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
  }, [layerMode, dataset, kedroBaseUrl, statements, metricConfig, preloadedData]);

  return {
    pointMetrics,
    metricConfig,
    setMetricConfig,
    metricsType,
    obsColumnKeys,
    metricsLegendItems,
    cycleObsColumn,
  };
}
