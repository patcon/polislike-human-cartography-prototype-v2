import { render, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { D3Map } from './D3Map';

// jsdom doesn't ship a Touch constructor; polyfill the properties the spotlight
// handlers actually access: identifier, clientX, clientY, target.
type TouchInit = { identifier: number; target: EventTarget; clientX: number; clientY: number };
const globalAny = global as unknown as Record<string, unknown>;
if (typeof globalAny['Touch'] === 'undefined') {
  globalAny['Touch'] = class Touch {
    identifier: number; target: EventTarget; clientX: number; clientY: number;
    constructor(init: TouchInit) { Object.assign(this, init); }
  };
}

// Extend the base D3 mock with spotlight-specific needs:
//   - data() returns [] (not `this`) so updateSelection's .filter() works
//   - zoom behavior exposes scaleBy / transform / translateBy
//   - zoomIdentity supports .translate().scale() chaining
vi.mock('d3', () => {
  const createMockSelection = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel: Record<string, any> = {
      attr: vi.fn().mockReturnThis(),
      append: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      // data() with no args → [] (read path used in updateSelection's .filter())
      // data(array, key?) with args → selection (write path used in D3 data join)
      data: vi.fn((...args: unknown[]) => args.length > 0 ? sel : []),
      enter: vi.fn(() => sel),
      exit: vi.fn(() => sel),
      select: vi.fn(() => sel),
      selectAll: vi.fn(() => sel),
      node: vi.fn(() => null),
      on: vi.fn().mockReturnThis(),
      style: vi.fn().mockReturnThis(),
    };
    return sel;
  };

  const mockZoom = {
    scaleExtent: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    scaleBy: vi.fn(),
    transform: vi.fn(),
    translateBy: vi.fn(),
  };

  return {
    select: vi.fn(() => createMockSelection()),
    extent: vi.fn(() => [0, 100]),
    scaleLinear: vi.fn(() => ({
      domain: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      invert: vi.fn((x: number) => x),
    })),
    quadtree: vi.fn(() => ({ find: vi.fn() })),
    zoom: vi.fn(() => mockZoom),
    zoomTransform: vi.fn(() => ({
      k: 1, x: 0, y: 0,
      invertX: vi.fn((x: number) => x),
      invertY: vi.fn((y: number) => y),
      applyX: vi.fn((x: number) => x),
      applyY: vi.fn((y: number) => y),
    })),
    zoomIdentity: {
      k: 1, x: 0, y: 0,
      translate: vi.fn(() => ({ scale: vi.fn(() => ({ k: 1, x: 0, y: 0 })) })),
    },
    pointer: vi.fn(() => [50, 50]),
    drag: vi.fn(() => ({ filter: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis() })),
    line: vi.fn(() => vi.fn()),
    scaleSequential: vi.fn(() => {
      const s = (v: number) => `rgb(${Math.round(v * 255)},${Math.round(v * 255)},255)`;
      s.domain = vi.fn().mockReturnValue(s);
      s.interpolator = vi.fn().mockReturnValue(s);
      return s;
    }),
    interpolateBlues: vi.fn((t: number) => `rgb(0,0,${Math.round(t * 255)})`),
    interpolateViridis: vi.fn((t: number) => `rgb(${Math.round(t * 68)},${Math.round(t + 84)},${Math.round(130 - t * 60)})`),
  };
});

describe('D3Map spotlight mode', () => {
  const mockData: [string, [number, number]][] = [
    ['1', [10, 20]],
    ['2', [30, 40]],
    ['3', [50, 60]],
  ];

  const onSelectionChange = vi.fn();
  const onSpotlightRadiusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
  });

  function renderSpotlight() {
    const result = render(
      <D3Map
        data={mockData}
        mode="spotlight"
        onSelectionChange={onSelectionChange}
        onSpotlightRadiusChange={onSpotlightRadiusChange}
        onQuickSelect={vi.fn()}
      />
    );
    return result.container.querySelector('svg')!;
  }

  // Lock the circle by clicking the SVG: handleClick places it (via d3.pointer → [50,50])
  // and sets mouseLocked = true.
  function lockCircle(svg: Element) {
    fireEvent.click(svg);
  }

  // Unlock: second click resumes unlocked state (circle stays placed).
  function unlockCircle(svg: Element) {
    fireEvent.click(svg);
  }

  // --- Desktop: scroll wheel ---

  describe('scroll wheel when unlocked', () => {
    it('resizes the circle and updates the selection', () => {
      const svg = renderSpotlight();

      // Place the circle first (lock then unlock so currentCx is set)
      lockCircle(svg);
      unlockCircle(svg);
      onSelectionChange.mockClear();
      onSpotlightRadiusChange.mockClear();

      fireEvent.wheel(svg, { deltaY: -100 });

      expect(onSpotlightRadiusChange).toHaveBeenCalledOnce();
      expect(onSelectionChange).toHaveBeenCalledOnce();
    });
  });

  describe('scroll wheel when locked (desktop click-to-lock)', () => {
    it('zooms the map without recomputing the selection', () => {
      const svg = renderSpotlight();

      lockCircle(svg);
      onSelectionChange.mockClear();
      onSpotlightRadiusChange.mockClear();

      fireEvent.wheel(svg, { deltaY: -100 });

      // Radius callback still fires (ring scales with the zoom)
      expect(onSpotlightRadiusChange).toHaveBeenCalledOnce();
      // Selection must NOT be recomputed — map and ring scale identically
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it('resumes recomputing the selection after unlocking', () => {
      const svg = renderSpotlight();

      lockCircle(svg);
      unlockCircle(svg);
      onSelectionChange.mockClear();

      fireEvent.wheel(svg, { deltaY: -100 });

      expect(onSelectionChange).toHaveBeenCalled();
    });
  });

  // --- Mobile: tap-to-lock ---

  function makeTap(svg: Element, x = 100, y = 100) {
    const touch = new Touch({ identifier: 0, target: svg, clientX: x, clientY: y });
    svg.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true, cancelable: true,
      touches: [touch], changedTouches: [touch],
    }));
    svg.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true, cancelable: true,
      touches: [], changedTouches: [touch],
    }));
  }

  function makeTouchMove(svg: Element, fromX: number, toX: number, y = 100) {
    const id = 99; // distinct identifier to avoid collisions with tap touches
    const start = new Touch({ identifier: id, target: svg, clientX: fromX, clientY: y });
    svg.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true, cancelable: true,
      touches: [start], changedTouches: [start],
    }));
    const moved = new Touch({ identifier: id, target: svg, clientX: toX, clientY: y });
    svg.dispatchEvent(new TouchEvent('touchmove', {
      bubbles: true, cancelable: true,
      touches: [moved], changedTouches: [moved],
    }));
  }

  describe('tap-to-lock (mobile)', () => {
    it('touch move when unlocked updates the selection', () => {
      const svg = renderSpotlight();
      onSelectionChange.mockClear();

      makeTouchMove(svg, 50, 150);

      expect(onSelectionChange).toHaveBeenCalled();
    });

    it('quick tap locks the circle; subsequent touch move does not update the selection', () => {
      const svg = renderSpotlight();

      makeTap(svg);
      onSelectionChange.mockClear();

      makeTouchMove(svg, 50, 150);

      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it('second tap unlocks; subsequent touch move updates the selection again', () => {
      const svg = renderSpotlight();

      makeTap(svg); // lock
      makeTap(svg); // unlock
      onSelectionChange.mockClear();

      makeTouchMove(svg, 50, 150);

      expect(onSelectionChange).toHaveBeenCalled();
    });
  });
});
