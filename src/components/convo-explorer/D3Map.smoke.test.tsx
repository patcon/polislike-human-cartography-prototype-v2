import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { D3Map } from './D3Map';

// Mock D3 completely to avoid DOM issues
vi.mock('d3', () => {
  const createMockSelection = () => {
    const mockSelection = {
      attr: vi.fn().mockReturnThis(),
      append: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      data: vi.fn().mockReturnThis(),
      enter: vi.fn(() => mockSelection),
      exit: vi.fn(() => mockSelection),
      select: vi.fn(() => mockSelection),
      selectAll: vi.fn(() => mockSelection),
      node: vi.fn(() => null),
      on: vi.fn().mockReturnThis(),
    };
    return mockSelection;
  };

  return {
    select: vi.fn(() => createMockSelection()),
    extent: vi.fn(() => [0, 100]),
    scaleLinear: vi.fn(() => ({
      domain: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      invert: vi.fn((x) => x),
    })),
    quadtree: vi.fn(() => ({
      find: vi.fn(),
    })),
    zoom: vi.fn(() => ({
      scaleExtent: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
    zoomTransform: vi.fn(() => ({
      k: 1,
      x: 0,
      y: 0,
      invertX: vi.fn((x) => x),
      invertY: vi.fn((y) => y),
      applyX: vi.fn((x) => x),
      applyY: vi.fn((y) => y),
    })),
    zoomIdentity: { k: 1, x: 0, y: 0 },
    pointer: vi.fn(() => [50, 50]),
    drag: vi.fn(() => ({
      filter: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
    line: vi.fn(() => vi.fn()),
    scaleSequential: vi.fn(() => {
      const scale = (v: number) => `rgb(${Math.round(v * 255)}, ${Math.round(v * 255)}, 255)`;
      scale.domain = vi.fn().mockReturnValue(scale);
      scale.interpolator = vi.fn().mockReturnValue(scale);
      return scale;
    }),
    interpolateBlues: vi.fn((t) => `rgb(0, 0, ${Math.round(t * 255)})`),
  };
});

describe('D3Map Smoke Tests', () => {
  const mockData: [string, [number, number]][] = [
    ["1", [10, 20]],
    ["2", [30, 40]],
    ["3", [50, 60]],
  ];

  const mockOnSelectionChange = vi.fn();
  const mockOnQuickSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  });

  it('should render SVG element in move mode', () => {
    const { container } = render(
      <D3Map
        data={mockData}
        mode="move"
        onQuickSelect={mockOnQuickSelect}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveClass('w-screen', 'h-screen', 'block', 'bg-gray-100');
  });

  it('should render SVG element in paint mode', () => {
    const { container } = render(
      <D3Map
        data={mockData}
        mode="paint"
        onQuickSelect={mockOnQuickSelect}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveClass('w-screen', 'h-screen', 'block', 'bg-gray-100');
  });

  it('should handle mode prop changes', () => {
    const { rerender } = render(
      <D3Map
        data={mockData}
        mode="move"
        onQuickSelect={mockOnQuickSelect}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    expect(() => {
      rerender(
        <D3Map
          data={mockData}
          mode="paint"
          onQuickSelect={mockOnQuickSelect}
          onSelectionChange={mockOnSelectionChange}
        />
      );
    }).not.toThrow();
  });

  it('should handle empty data', () => {
    expect(() => {
      render(
        <D3Map
          data={[]}
          mode="move"
          onQuickSelect={mockOnQuickSelect}
          onSelectionChange={mockOnSelectionChange}
        />
      );
    }).not.toThrow();
  });

  it('should handle optional props', () => {
    expect(() => {
      render(
        <D3Map
          data={mockData}
          mode="move"
          pointColors={[0, 1, 2]}
          palette={['red', 'green', 'blue']}
          flipX={true}
          flipY={true}
          onQuickSelect={mockOnQuickSelect}
          onSelectionChange={mockOnSelectionChange}
        />
      );
    }).not.toThrow();
  });
});