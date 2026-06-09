"use client";

import * as React from "react";
import * as d3 from "d3";

type MapPoint = { i: string; x: number; y: number; originalIndex: number };
type D3ContainerExt = d3.Selection<SVGGElement, unknown, null, undefined> & {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
};

export type SpotlightDebugState = {
  event: string;
  touchCount: number;
  currentRadius: number;
  cx: number;
  cy: number;
  grabOffsetX: number;
  grabOffsetY: number;
};

type UseSpotlightModeOptions = {
  mode: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>;
  zoomRef: React.MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>;
  displayMask?: boolean[];
  onSelectionChange?: (ids: (number | string)[]) => void;
  spotlightRadius: number;
  spotlightPersist: boolean;
  onSpotlightRadiusChange?: (radius: number) => void;
  onSpotlightDebug?: (state: SpotlightDebugState) => void;
};

function isTap(dx: number, dy: number, durationMs: number, maxDist = 10, maxMs = 500) {
  return Math.hypot(dx, dy) < maxDist && durationMs < maxMs;
}

export function useSpotlightMode({
  mode,
  svgRef,
  containerRef,
  zoomRef,
  displayMask,
  onSelectionChange,
  spotlightRadius,
  spotlightPersist,
  onSpotlightRadiusChange,
  onSpotlightDebug,
}: UseSpotlightModeOptions): void {
  const spotlightStateRef = React.useRef({
    currentRadius: spotlightRadius,
    currentCx: -9999,
    currentCy: -9999,
    persist: spotlightPersist,
    grabOffsetX: 0,
    grabOffsetY: 0,
    touchPrevPositions: new Map<number, [number, number]>(),
    mouseLocked: false,
    tapStartTime: 0,
    tapStartPos: null as [number, number] | null,
  });
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  const onSpotlightDebugRef = React.useRef(onSpotlightDebug);
  const onSpotlightRadiusChangeRef = React.useRef(onSpotlightRadiusChange);
  const displayMaskRef = React.useRef(displayMask);
  // Tracks whether the most recent spotlightRadius change was reported outward by a gesture.
  // If so, the sync effect must not write back — doing so would overwrite a newer gesture value.
  const radiusFromGestureRef = React.useRef(false);

  React.useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  React.useEffect(() => { onSpotlightDebugRef.current = onSpotlightDebug; }, [onSpotlightDebug]);
  React.useEffect(() => { onSpotlightRadiusChangeRef.current = onSpotlightRadiusChange; }, [onSpotlightRadiusChange]);
  React.useEffect(() => { displayMaskRef.current = displayMask; }, [displayMask]);
  React.useEffect(() => {
    if (radiusFromGestureRef.current) { radiusFromGestureRef.current = false; return; }
    spotlightStateRef.current.currentRadius = spotlightRadius;
  }, [spotlightRadius]);
  React.useEffect(() => { spotlightStateRef.current.persist = spotlightPersist; }, [spotlightPersist]);

  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (mode !== "spotlight") return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const svgNode = svgRef.current;

    // Prevent native touch scroll/pan while spotlight is active
    svgNode.style.touchAction = "none";

    const ring = svg.append("circle")
      .attr("class", "spotlight-ring")
      .attr("fill", "rgba(255, 220, 0, 0.08)")
      .attr("stroke", "#FFCC00")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6 3")
      .attr("cx", -9999)
      .attr("cy", -9999)
      .attr("r", spotlightStateRef.current.currentRadius)
      .style("pointer-events", "none");

    // All mutable touch state lives in spotlightStateRef so it survives effect re-runs.
    // Callbacks are accessed via refs so they never appear in deps and never trigger re-runs.
    const s = spotlightStateRef.current;

    function debug(eventName: string, touchCount: number) {
      onSpotlightDebugRef.current?.({ event: eventName, touchCount, currentRadius: s.currentRadius, cx: s.currentCx, cy: s.currentCy, grabOffsetX: s.grabOffsetX, grabOffsetY: s.grabOffsetY });
    }

    function touchToSVG(touch: Touch): [number, number] {
      const rect = svgNode.getBoundingClientRect();
      return [touch.clientX - rect.left, touch.clientY - rect.top];
    }

    function updateSelection(cx: number, cy: number, radius: number) {
      s.currentCx = cx;
      s.currentCy = cy;
      ring.attr("cx", cx).attr("cy", cy).attr("r", radius);
      const transform = d3.zoomTransform(container.node()!);
      const ext = container as unknown as D3ContainerExt;
      const selected = (container.selectAll("circle").data() as MapPoint[]).filter((d) => {
        if (displayMaskRef.current && !displayMaskRef.current[d.originalIndex]) return false;
        const sx = transform.applyX(ext.xScale(d.x));
        const sy = transform.applyY(ext.yScale(d.y));
        return Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2) <= radius;
      });
      onSelectionChangeRef.current?.(selected.map((d) => d.i));
    }

    function resetAllTouches() {
      s.touchPrevPositions.clear();
      if (!s.persist) {
        ring.attr("cx", -9999).attr("cy", -9999);
        s.currentCx = -9999;
        s.currentCy = -9999;
        onSelectionChangeRef.current?.([]);
      }
    }

    function captureAllTouches(touches: TouchList) {
      s.touchPrevPositions.clear();
      for (let i = 0; i < touches.length; i++) {
        s.touchPrevPositions.set(touches[i].identifier, touchToSVG(touches[i]));
      }
    }

    function setupGrabOffset(touch: Touch) {
      const [tx, ty] = touchToSVG(touch);
      s.grabOffsetX = s.currentCx === -9999 ? 0 : s.currentCx - tx;
      s.grabOffsetY = s.currentCy === -9999 ? 0 : s.currentCy - ty;
    }

    // --- Touch Events (handles multi-touch reliably via event.touches) ---
    function handleTouchStart(event: TouchEvent) {
      event.preventDefault();
      const n = event.touches.length;
      captureAllTouches(event.touches);

      if (n === 1) {
        const [tx, ty] = touchToSVG(event.touches[0]);
        s.tapStartTime = Date.now();
        s.tapStartPos = [tx, ty];
        if (!s.mouseLocked) {
          if (s.currentCx === -9999) {
            // First placement — center circle on the touch point
            updateSelection(tx, ty, s.currentRadius);
            s.grabOffsetX = 0;
            s.grabOffsetY = 0;
          } else {
            s.grabOffsetX = s.currentCx - tx;
            s.grabOffsetY = s.currentCy - ty;
          }
        }
      } else {
        // Multi-touch: cancel any pending tap
        s.tapStartPos = null;
        if (n === 2 && s.currentCx === -9999 && !s.mouseLocked) {
          // Two fingers on an unpositioned circle — place center at midpoint
          const [ax, ay] = touchToSVG(event.touches[0]);
          const [bx, by] = touchToSVG(event.touches[1]);
          updateSelection((ax + bx) / 2, (ay + by) / 2, s.currentRadius);
        }
      }
      debug(`touch:start:${n}`, n);
    }

    function handleTouchMove(event: TouchEvent) {
      event.preventDefault();
      const n = event.touches.length;

      if (n === 1) {
        const touch = event.touches[0];
        const [tx, ty] = touchToSVG(touch);
        if (s.mouseLocked) {
          const prev = s.touchPrevPositions.get(touch.identifier);
          if (prev && zoomRef.current) {
            const dx = tx - prev[0];
            const dy = ty - prev[1];
            // translateBy multiplies by k internally, so use transform to shift T.x/T.y
            // directly by SVG pixel delta — keeping ring and map in sync at any zoom level.
            const T = d3.zoomTransform(svgNode);
            zoomRef.current.transform(d3.select(svgNode),
              d3.zoomIdentity.translate(T.x + dx, T.y + dy).scale(T.k));
            if (s.currentCx !== -9999) {
              s.currentCx += dx;
              s.currentCy += dy;
              ring.attr("cx", s.currentCx).attr("cy", s.currentCy);
            }
          }
          s.touchPrevPositions.set(touch.identifier, [tx, ty]);
          debug("touch:move:1:locked", n);
          return;
        }
        updateSelection(tx + s.grabOffsetX, ty + s.grabOffsetY, s.currentRadius);
        s.touchPrevPositions.set(touch.identifier, [tx, ty]);
        debug("touch:move:1", n);
      } else if (n >= 2) {
        const tA = event.touches[0];
        const tB = event.touches[1];
        const currA = touchToSVG(tA);
        const currB = touchToSVG(tB);
        const prevA = s.touchPrevPositions.get(tA.identifier);
        const prevB = s.touchPrevPositions.get(tB.identifier);

        if (!prevA || !prevB) {
          // Shouldn't normally happen — capture and wait for next frame
          s.touchPrevPositions.set(tA.identifier, currA);
          s.touchPrevPositions.set(tB.identifier, currB);
          return;
        }

        const prevDist = Math.hypot(prevA[0] - prevB[0], prevA[1] - prevB[1]);
        const currDist = Math.hypot(currA[0] - currB[0], currA[1] - currB[1]);
        if (prevDist < 1) {
          s.touchPrevPositions.set(tA.identifier, currA);
          s.touchPrevPositions.set(tB.identifier, currB);
          return;
        }

        const scale = currDist / prevDist;
        const prevMidX = (prevA[0] + prevB[0]) / 2;
        const prevMidY = (prevA[1] + prevB[1]) / 2;
        const currMidX = (currA[0] + currB[0]) / 2;
        const currMidY = (currA[1] + currB[1]) / 2;

        if (s.mouseLocked && zoomRef.current) {
          // Locked: pinch+pan zooms the map; keep ring over same data region
          const T = d3.zoomTransform(svgNode);
          const newT = d3.zoomIdentity
            .translate(scale * T.x + (currMidX - scale * prevMidX), scale * T.y + (currMidY - scale * prevMidY))
            .scale(scale * T.k);
          zoomRef.current.transform(d3.select(svgNode), newT);
          s.currentRadius = Math.max(10, Math.min(500, s.currentRadius * scale));
          if (s.currentCx !== -9999) {
            s.currentCx = scale * (s.currentCx - prevMidX) + currMidX;
            s.currentCy = scale * (s.currentCy - prevMidY) + currMidY;
          }
          ring.attr("cx", s.currentCx).attr("cy", s.currentCy).attr("r", s.currentRadius);
          radiusFromGestureRef.current = true;
          onSpotlightRadiusChangeRef.current?.(s.currentRadius);
          s.touchPrevPositions.set(tA.identifier, currA);
          s.touchPrevPositions.set(tB.identifier, currB);
          debug("touch:move:2:locked", n);
          return;
        }

        const rotation = Math.atan2(currB[1] - currA[1], currB[0] - currA[0])
                       - Math.atan2(prevB[1] - prevA[1], prevB[0] - prevA[0]);

        // Apply similarity transform (scale + rotation + translation) to circle center
        const dx = s.currentCx - prevMidX;
        const dy = s.currentCy - prevMidY;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const newCx = currMidX + scale * (dx * cos - dy * sin);
        const newCy = currMidY + scale * (dx * sin + dy * cos);

        s.currentRadius = Math.max(10, Math.min(500, s.currentRadius * scale));
        updateSelection(newCx, newCy, s.currentRadius);
        radiusFromGestureRef.current = true;
        onSpotlightRadiusChangeRef.current?.(s.currentRadius);

        s.touchPrevPositions.set(tA.identifier, currA);
        s.touchPrevPositions.set(tB.identifier, currB);
        debug("touch:move:2", n);
      }
    }

    function handleTouchEnd(event: TouchEvent) {
      const n = event.touches.length;
      if (n === 0) {
        if (s.tapStartPos && event.changedTouches.length === 1) {
          const [ex, ey] = touchToSVG(event.changedTouches[0]);
          const tapDuration = Date.now() - s.tapStartTime;
          if (isTap(ex - s.tapStartPos[0], ey - s.tapStartPos[1], tapDuration)) {
            s.mouseLocked = !s.mouseLocked;
            if (s.mouseLocked) {
              ring.attr("stroke-dasharray", null).attr("stroke-width", 2.5);
              if (s.currentCx === -9999) updateSelection(ex, ey, s.currentRadius);
            } else {
              ring.attr("stroke-dasharray", "6 3").attr("stroke-width", 2);
            }
          }
        }
        s.tapStartPos = null;
        s.tapStartTime = 0;
        if (!s.mouseLocked) resetAllTouches();
        debug("touch:end:0", n);
      } else {
        s.tapStartPos = null;
        captureAllTouches(event.touches);
        if (n === 1 && !s.mouseLocked) setupGrabOffset(event.touches[0]);
        debug(`touch:end:${n}`, n);
      }
    }

    function handleTouchCancel(event: TouchEvent) {
      // Only reset if all touches are gone; spurious cancels mid-gesture should be ignored
      debug(`touch:cancel:${event.touches.length}`, event.touches.length);
      s.tapStartPos = null;
      if (event.touches.length === 0) {
        if (!s.mouseLocked) resetAllTouches();
      } else {
        captureAllTouches(event.touches);
        if (event.touches.length === 1 && !s.mouseLocked) setupGrabOffset(event.touches[0]);
      }
    }

    // --- Mouse (Pointer Events, mouse only) ---
    function handlePointerEnter(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      if (s.mouseLocked) return;
      const [px, py] = d3.pointer(event, svgNode);
      updateSelection(px, py, s.currentRadius);
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      if (s.mouseLocked) return;
      const [px, py] = d3.pointer(event, svgNode);
      updateSelection(px, py, s.currentRadius);
    }

    function handlePointerLeave(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      if (s.mouseLocked) return;
      ring.attr("cx", -9999).attr("cy", -9999);
      s.currentCx = -9999;
      s.currentCy = -9999;
      onSelectionChangeRef.current?.([]);
    }

    function handleClick(event: MouseEvent) {
      s.mouseLocked = !s.mouseLocked;
      if (s.mouseLocked) {
        // Lock: place circle at current pointer position and freeze it there
        const [px, py] = d3.pointer(event, svgNode);
        updateSelection(px, py, s.currentRadius);
        ring.attr("stroke-dasharray", null).attr("stroke-width", 2.5);
        svgNode.style.cursor = "crosshair";
      } else {
        // Unlock: resume following the pointer from where it is now
        ring.attr("stroke-dasharray", "6 3").attr("stroke-width", 2);
        svgNode.style.cursor = "";
        const [px, py] = d3.pointer(event, svgNode);
        updateSelection(px, py, s.currentRadius);
      }
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      if (s.mouseLocked && zoomRef.current) {
        const factor = event.deltaMode === 0 ? 0.002 : 0.06;
        const scaleFactor = Math.pow(2, -event.deltaY * factor);
        const [px, py] = d3.pointer(event, svgNode);
        zoomRef.current.scaleBy(d3.select(svgNode), scaleFactor, [px, py]);
        // Keep the ring covering the same data region: scale radius and translate
        // center by the same focal-point transform the container just received.
        s.currentRadius = s.currentRadius * scaleFactor;
        if (s.currentCx !== -9999) {
          s.currentCx = px + scaleFactor * (s.currentCx - px);
          s.currentCy = py + scaleFactor * (s.currentCy - py);
        }
        ring.attr("cx", s.currentCx).attr("cy", s.currentCy).attr("r", s.currentRadius);
        radiusFromGestureRef.current = true;
        onSpotlightRadiusChangeRef.current?.(s.currentRadius);
        return;
      }
      const factor = event.deltaMode === 0 ? 0.002 : 0.06;
      s.currentRadius = Math.max(10, Math.min(500, s.currentRadius * (1 - event.deltaY * factor)));
      if (s.currentCx !== -9999) {
        updateSelection(s.currentCx, s.currentCy, s.currentRadius);
      } else {
        ring.attr("r", s.currentRadius);
      }
      radiusFromGestureRef.current = true;
      onSpotlightRadiusChangeRef.current?.(s.currentRadius);
    }

    svgNode.addEventListener("touchstart", handleTouchStart, { passive: false });
    svgNode.addEventListener("touchmove", handleTouchMove, { passive: false });
    svgNode.addEventListener("touchend", handleTouchEnd);
    svgNode.addEventListener("touchcancel", handleTouchCancel);
    svgNode.addEventListener("pointerenter", handlePointerEnter);
    svgNode.addEventListener("pointermove", handlePointerMove);
    svgNode.addEventListener("pointerleave", handlePointerLeave);
    svgNode.addEventListener("click", handleClick);
    svgNode.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      ring.remove();
      svgNode.style.touchAction = "";
      svgNode.style.cursor = "";
      svgNode.removeEventListener("touchstart", handleTouchStart);
      svgNode.removeEventListener("touchmove", handleTouchMove);
      svgNode.removeEventListener("touchend", handleTouchEnd);
      svgNode.removeEventListener("touchcancel", handleTouchCancel);
      svgNode.removeEventListener("pointerenter", handlePointerEnter);
      svgNode.removeEventListener("pointermove", handlePointerMove);
      svgNode.removeEventListener("pointerleave", handlePointerLeave);
      svgNode.removeEventListener("click", handleClick);
      svgNode.removeEventListener("wheel", handleWheel);
    };
  }, [mode]); // callbacks + display state accessed via refs — no re-run needed when they change
}
