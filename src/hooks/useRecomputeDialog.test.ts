import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRecomputeDialog } from './useRecomputeDialog';
import * as druidWorkerModule from '@/hooks/useDruidWorker';
import type { DruidWorkerState } from '@/hooks/useDruidWorker';

vi.mock('@/hooks/useDruidWorker', () => ({
  useDruidWorker: vi.fn(),
}));

const makeDruidState = (overrides: Partial<DruidWorkerState> = {}): DruidWorkerState => ({
  status: 'idle',
  coords: null,
  error: null,
  progress: null,
  runReduction: vi.fn(),
  reset: vi.fn(),
  ...overrides,
});

const defaultProps = {
  preloadedData: undefined as any,
  dataset: [['p1', [0, 0]], ['p2', [1, 1]]] as [string, [number, number]][],
  currentPipelineIdRef: { current: 'default' } as React.MutableRefObject<string>,
};

describe('useRecomputeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(druidWorkerModule.useDruidWorker).mockReturnValue(makeDruidState());
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useRecomputeDialog(defaultProps));

    expect(result.current.recomputeDialogOpen).toBe(false);
    expect(result.current.recomputedProjections).toEqual({});
  });

  it('setRecomputeDialogOpen opens the dialog', () => {
    const { result } = renderHook(() => useRecomputeDialog(defaultProps));

    act(() => {
      result.current.setRecomputeDialogOpen(true);
    });

    expect(result.current.recomputeDialogOpen).toBe(true);
  });

  it('exposes druid status, error, and progress from useDruidWorker', () => {
    vi.mocked(druidWorkerModule.useDruidWorker).mockReturnValue(
      makeDruidState({ status: 'running', progress: 0.5, error: null })
    );

    const { result } = renderHook(() => useRecomputeDialog(defaultProps));

    expect(result.current.druidStatus).toBe('running');
    expect(result.current.druidProgress).toBe(0.5);
    expect(result.current.druidError).toBeNull();
  });

  it('adds a new projection to recomputedProjections when druidStatus transitions to done', () => {
    const coords: [number, number][] = [[0.1, 0.2], [0.3, 0.4]];

    vi.mocked(druidWorkerModule.useDruidWorker).mockReturnValue(
      makeDruidState({ status: 'done', coords })
    );

    const { result } = renderHook(() => useRecomputeDialog(defaultProps));

    expect(result.current.recomputedProjections).not.toEqual({});
    const keys = Object.keys(result.current.recomputedProjections);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain('recomputed');
  });

  it('generates unique projection keys when run multiple times', () => {
    const coords: [number, number][] = [[0, 0], [1, 1]];
    vi.mocked(druidWorkerModule.useDruidWorker).mockReturnValue(
      makeDruidState({ status: 'done', coords })
    );

    const { result, rerender } = renderHook(() => useRecomputeDialog(defaultProps));

    // Simulate a second completion with a different coords reference
    vi.mocked(druidWorkerModule.useDruidWorker).mockReturnValue(
      makeDruidState({ status: 'done', coords: [[2, 2], [3, 3]] })
    );
    act(() => { rerender(); });

    const keys = Object.keys(result.current.recomputedProjections);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
