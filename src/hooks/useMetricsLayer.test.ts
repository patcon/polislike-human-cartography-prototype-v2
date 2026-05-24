import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as duckdb from '@/lib/duckdb';
import { useMetricsLayer } from './useMetricsLayer';

vi.mock('@/lib/duckdb', () => ({
  getVoteCountsForAllParticipants: vi.fn().mockResolvedValue(new Map()),
  getNonModeratedStatementIds: vi.fn(() => []),
}));

vi.mock('@/lib/kedro-api', () => ({
  getPrincipalComponentValues: vi.fn().mockResolvedValue(new Map()),
}));

const dataset: [string, [number, number]][] = [
  ['p1', [0, 0]],
  ['p2', [1, 1]],
];

const defaultProps = {
  layerMode: 'groups' as const,
  dataset,
  statements: [{ statement_id: '1', txt: 'Hello', moderated: 0 }],
  preloadedData: undefined as any,
  kedroBaseUrl: undefined as string | undefined,
  currentPipelineIdRef: { current: 'default' } as React.MutableRefObject<string>,
};

describe('useMetricsLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useMetricsLayer(defaultProps));

    expect(result.current.metricConfig).toEqual({ type: 'vote-count', style: 'color' });
    expect(result.current.metricsType).toBe('continuous');
    expect(result.current.obsColumnKeys).toBeUndefined();
    expect(result.current.metricsLegendItems).toBeUndefined();
  });

  it('pointMetrics length matches dataset after initialization', () => {
    const { result } = renderHook(() => useMetricsLayer(defaultProps));

    expect(result.current.pointMetrics).toHaveLength(dataset.length);
    expect(result.current.pointMetrics.every(v => v === null)).toBe(true);
  });

  it('setMetricConfig updates the config', () => {
    const { result } = renderHook(() => useMetricsLayer(defaultProps));

    act(() => {
      result.current.setMetricConfig({ type: 'obs-column', column: 'my_col' });
    });

    expect(result.current.metricConfig).toEqual({ type: 'obs-column', column: 'my_col' });
  });

  it('does not call getVoteCountsForAllParticipants when layerMode is not metrics', async () => {
    renderHook(() => useMetricsLayer({ ...defaultProps, layerMode: 'groups' }));

    await act(async () => {});

    expect(vi.mocked(duckdb.getVoteCountsForAllParticipants)).not.toHaveBeenCalled();
  });

  it('provides obsColumnKeys from preloadedData obsColumns (excluding display mask)', () => {
    const preloadedData = {
      dataset,
      statements: [],
      votesRows: [],
      obsColumns: {
        cluster_mask: { type: 'boolean' as const, values: [1, 0] as (number | null)[] },
        age: { type: 'continuous' as const, values: [25, 30] },
        region: { type: 'categorical' as const, values: ['A', 'B'], categories: ['A', 'B'] },
      },
    };

    const { result } = renderHook(() =>
      useMetricsLayer({ ...defaultProps, preloadedData })
    );

    expect(result.current.obsColumnKeys).toContain('age');
    expect(result.current.obsColumnKeys).toContain('region');
    expect(result.current.obsColumnKeys).not.toContain('cluster_mask');
  });

  it('cycleObsColumn advances to the next obs column', () => {
    const preloadedData = {
      dataset,
      statements: [],
      votesRows: [],
      obsColumns: {
        col1: { type: 'continuous' as const, values: [1, 2] },
        col2: { type: 'continuous' as const, values: [3, 4] },
        col3: { type: 'continuous' as const, values: [5, 6] },
      },
    };

    const { result } = renderHook(() =>
      useMetricsLayer({ ...defaultProps, preloadedData })
    );

    act(() => {
      result.current.setMetricConfig({ type: 'obs-column', column: 'col1' });
    });

    act(() => {
      result.current.cycleObsColumn('next');
    });

    expect(result.current.metricConfig).toEqual({ type: 'obs-column', column: 'col2' });
  });

  it('cycleObsColumn wraps around at the end', () => {
    const preloadedData = {
      dataset,
      statements: [],
      votesRows: [],
      obsColumns: {
        col1: { type: 'continuous' as const, values: [1, 2] },
        col2: { type: 'continuous' as const, values: [3, 4] },
      },
    };

    const { result } = renderHook(() =>
      useMetricsLayer({ ...defaultProps, preloadedData })
    );

    act(() => {
      result.current.setMetricConfig({ type: 'obs-column', column: 'col2' });
    });

    act(() => {
      result.current.cycleObsColumn('next');
    });

    expect(result.current.metricConfig).toEqual({ type: 'obs-column', column: 'col1' });
  });
});
