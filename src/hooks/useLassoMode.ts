"use client";

import * as React from "react";
import * as d3 from "d3";

type MapPoint = { i: string; x: number; y: number; originalIndex: number };
type D3ContainerExt = d3.Selection<SVGGElement, unknown, null, undefined> & {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
};

function pointInPolygon([x, y]: [number, number], vs: [number, number][]) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [xi, yi] = vs[i], [xj, yj] = vs[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

type UseLassoModeOptions = {
  mode: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>;
  displayMask?: boolean[];
  onSelectionChange?: (ids: (number | string)[]) => void;
  onLassoStart?: () => void;
  onLassoEnd?: () => void;
};

type UseLassoModeResult = {
  /** Ref to the current lasso cleanup function — read by the zoom effect on multi-touch start */
  lassoCleanupRef: React.MutableRefObject<(() => void) | null>;
};

export function useLassoMode({
  mode,
  svgRef,
  containerRef,
  displayMask,
  onSelectionChange,
  onLassoStart,
  onLassoEnd,
}: UseLassoModeOptions): UseLassoModeResult {
  const lassoRectRef = React.useRef<SVGRectElement | null>(null);
  const lassoStateRef = React.useRef<{
    path: d3.Selection<SVGPathElement, unknown, null, undefined> | null;
    coords: [number, number][];
  }>({ path: null, coords: [] });
  const lassoCleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;

    // Clean up any previous lasso drag when mode changes
    svg.on('.drag', null);

    if (lassoRectRef.current) {
      d3.select(lassoRectRef.current).remove();
      lassoRectRef.current = null;
    }

    if (mode === "paint") {
      function cleanupLasso(callEndCallback = false) {
        console.log('🎨 Lasso CLEANUP, callEndCallback:', callEndCallback);
        if (lassoStateRef.current.path) {
          lassoStateRef.current.path.remove();
          lassoStateRef.current.path = null;
        }
        lassoStateRef.current.coords = [];

        // Only call onLassoEnd when explicitly requested (normal end, not cleanup)
        if (callEndCallback) {
          onLassoEnd?.();
        }
      }

      lassoCleanupRef.current = cleanupLasso;

      function lassoStart(event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) {
        console.log('🎨 Lasso START:', event.sourceEvent?.type);
        if (event.sourceEvent && (event.sourceEvent.touches?.length ?? 1) > 1) {
          cleanupLasso(true); // End cycling on multi-touch
          return;
        }

        lassoStateRef.current.coords = [];
        if (lassoStateRef.current.path) lassoStateRef.current.path.remove();
        lassoStateRef.current.path = svg.append("path")
          .attr("fill", "rgba(0,0,0,0.1)")
          .attr("stroke", "#666")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4 2")
          .style("pointer-events", "none");
      }

      function lassoDrag(event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) {
        console.log('🎨 Lasso DRAG:', event.sourceEvent?.type);
        if (event.sourceEvent && (event.sourceEvent.touches?.length ?? 1) > 1) {
          cleanupLasso(true); // End cycling on multi-touch
          return;
        }

        // Trigger layer mode cycling when we get the first drag event (lasso is actually happening)
        if (lassoStateRef.current.coords.length === 0) {
          onLassoStart?.();
        }

        lassoStateRef.current.coords.push([event.x, event.y]);
        if (lassoStateRef.current.path) {
          lassoStateRef.current.path.attr("d", d3.line()(lassoStateRef.current.coords));
        }
      }

      function lassoEnd() {
        console.log('🎨 Lasso END, coords:', lassoStateRef.current.coords.length);

        if (!lassoStateRef.current.coords.length) {
          cleanupLasso(true);
          return;
        }
        const transform = d3.zoomTransform(container.node()!);
        const circles = container.selectAll("circle");
        const selected = (circles.data() as MapPoint[]).filter((d) => {
          if (displayMask && !displayMask[d.originalIndex]) return false;
          const ext = container as unknown as D3ContainerExt;
          const sx = transform.applyX(ext.xScale(d.x));
          const sy = transform.applyY(ext.yScale(d.y));
          return pointInPolygon([sx, sy], lassoStateRef.current.coords);
        });
        if (onSelectionChange) onSelectionChange(selected.map((d) => d.i));

        cleanupLasso(true);
      }

      svg.call(
        d3.drag<SVGSVGElement, unknown>()
          .filter((event) => (event.sourceEvent?.touches?.length ?? 0) <= 1)
          .on("start", lassoStart)
          .on("drag", lassoDrag)
          .on("end", lassoEnd)
      );

      // To avoid type warning in case lassoRectRef is null
      if (!lassoRectRef.current) return;

      d3.select(lassoRectRef.current).call(
        // @ts-expect-error - Complex D3 drag behavior type issue, ignoring for now
        d3.drag<SVGRectElement, unknown>()
          .filter((event) => (event.sourceEvent?.touches?.length ?? 0) <= 1)
          .on("start", lassoStart)
          .on("drag", lassoDrag)
          .on("end", lassoEnd)
      )
      .on("touchstart.zoom", null)
      .on("touchmove.zoom", null)
      .on("touchend.zoom", null);

      return () => {
        cleanupLasso(true);
        lassoCleanupRef.current = null;
      };
    } else {
      lassoCleanupRef.current = null;
    }
  }, [mode, onSelectionChange, onLassoStart, onLassoEnd, displayMask]);

  return { lassoCleanupRef };
}
