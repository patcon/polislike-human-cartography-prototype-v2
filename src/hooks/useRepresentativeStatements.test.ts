import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRepresentativeStatements } from './useRepresentativeStatements';
import * as repStatementsLib from '@/lib/representative-statements';

vi.mock('@/lib/representative-statements', () => ({
  calculateRepresentativeStatements: vi.fn(),
  createStatementTextMap: vi.fn(() => ({})),
  getLabelArrayWithOptionalUngrouped: vi.fn(() => []),
}));

const mockSetDrawerTab = vi.fn();

const defaultProps = {
  statements: [{ statement_id: '1', txt: 'Hello', moderated: 0 }],
  dataset: [['p1', [0, 0]], ['p2', [1, 1]]] as [string, [number, number]][],
  pointGroups: [-1, -1],
  currentPipelineId: 'default',
  kedroBaseUrl: undefined as string | undefined,
  isUnpaintedGrouped: true,
  drawerTab: 'all',
  setDrawerTab: mockSetDrawerTab,
};

describe('useRepresentativeStatements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const { result } = renderHook(() => useRepresentativeStatements(defaultProps));

    expect(result.current.representativeStatements).toEqual({});
    expect(result.current.consensusStatements).toBeNull();
    expect(result.current.isCalculatingRepStatements).toBe(false);
    expect(result.current.repStatementsError).toBeNull();
  });

  it('does nothing when fewer than 2 groups', async () => {
    vi.mocked(repStatementsLib.getLabelArrayWithOptionalUngrouped).mockReturnValue([null, null]);

    const { result } = renderHook(() => useRepresentativeStatements(defaultProps));

    await act(async () => {
      await result.current.calculateRepStatements([-1, -1]);
    });

    expect(repStatementsLib.calculateRepresentativeStatements).not.toHaveBeenCalled();
    expect(result.current.isCalculatingRepStatements).toBe(false);
  });

  it('sets isCalculatingRepStatements true while calculation is in progress', async () => {
    vi.mocked(repStatementsLib.getLabelArrayWithOptionalUngrouped).mockReturnValue(['group-1', 'group-2']);

    let resolveCalc!: (v: unknown) => void;
    vi.mocked(repStatementsLib.calculateRepresentativeStatements).mockReturnValue(
      new Promise(resolve => { resolveCalc = resolve; }) as Promise<unknown>
    );

    const { result } = renderHook(() => useRepresentativeStatements(defaultProps));

    act(() => {
      result.current.calculateRepStatements([1, 2]);
    });

    expect(result.current.isCalculatingRepStatements).toBe(true);

    await act(async () => {
      resolveCalc({ repComments: {}, consensusStatements: { agree: [], disagree: [] } });
    });

    expect(result.current.isCalculatingRepStatements).toBe(false);
  });

  it('populates representativeStatements and consensusStatements on success', async () => {
    vi.mocked(repStatementsLib.getLabelArrayWithOptionalUngrouped).mockReturnValue(['group-1', 'group-2']);
    vi.mocked(repStatementsLib.calculateRepresentativeStatements).mockResolvedValue({
      repComments: { 'group-1': [], 'group-2': [] },
      consensusStatements: { agree: [], disagree: [] },
    } as unknown as Awaited<ReturnType<typeof repStatementsLib.calculateRepresentativeStatements>>);

    const { result } = renderHook(() => useRepresentativeStatements(defaultProps));

    await act(async () => {
      await result.current.calculateRepStatements([1, 2]);
    });

    expect(result.current.representativeStatements).toEqual({ 'group-1': [], 'group-2': [] });
    expect(result.current.consensusStatements).toEqual({ agree: [], disagree: [] });
    expect(result.current.isCalculatingRepStatements).toBe(false);
    expect(result.current.repStatementsError).toBeNull();
  });

  it('sets repStatementsError and clears loading on failure', async () => {
    vi.mocked(repStatementsLib.getLabelArrayWithOptionalUngrouped).mockReturnValue(['group-1', 'group-2']);
    vi.mocked(repStatementsLib.calculateRepresentativeStatements).mockRejectedValue(
      new Error('DuckDB failed')
    );

    const { result } = renderHook(() => useRepresentativeStatements(defaultProps));

    await act(async () => {
      await result.current.calculateRepStatements([1, 2]);
    });

    expect(result.current.repStatementsError).toBe('DuckDB failed');
    expect(result.current.isCalculatingRepStatements).toBe(false);
  });

  it('clearRepStatements resets all state', async () => {
    vi.mocked(repStatementsLib.getLabelArrayWithOptionalUngrouped).mockReturnValue(['group-1', 'group-2']);
    vi.mocked(repStatementsLib.calculateRepresentativeStatements).mockResolvedValue({
      repComments: { 'group-1': [] },
      consensusStatements: { agree: [], disagree: [] },
    } as unknown as Awaited<ReturnType<typeof repStatementsLib.calculateRepresentativeStatements>>);

    const { result } = renderHook(() => useRepresentativeStatements(defaultProps));

    await act(async () => {
      await result.current.calculateRepStatements([1, 2]);
    });

    act(() => {
      result.current.clearRepStatements();
    });

    expect(result.current.representativeStatements).toEqual({});
    expect(result.current.consensusStatements).toBeNull();
    expect(result.current.repStatementsError).toBeNull();
  });
});
