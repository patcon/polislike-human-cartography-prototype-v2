"use client";

import * as React from "react";
import * as d3 from "d3";
import { PALETTE_COLORS, UNPAINTED_COLOR, UNPAINTED_VALUE, OUTLINE_RADIUS, OUTLINE_OPACITY, OUTLINE_SUSPEND_DURING_ANIMATION, FEATURE_HIDE_NULL_METRICS } from "@/constants";
import type { ObsColumnType } from "@/lib/color-schemes";
import { BOOLEAN_COLORS, NULL_COLOR, HIDE_NULL_POINTS, createContinuousScale, getCategoricalColor } from "@/lib/color-schemes";
import { usePipelineOptions } from "../../../.storybook/hooks/usePipelineOptions";
import { MapProjectionSelector } from "./MapProjectionSelector";
import { Button } from "../ui/button";
import { Import, Info } from "lucide-react";

type ProjectionData = [string, [number, number]][];


const FEATURE_SCALE_RADIUS_ON_ZOOM = true;

type D3MapProps = {
  /** Dataset points in the format [[i, [x, y]], ...] */
  data: [string, [number, number]][];
  mode?: "move" | "paint";
  /** Color indices parallel to data: null = default color, number = palette index (groups/votes) or 0-1 values (metrics) */
  pointColors?: (number | null)[];
  /** Color palette to use for rendering points */
  palette?: string[];
  /** Current layer mode for determining coloring strategy */
  layerMode?: "groups" | "votes" | "metrics";
  /** Type of the current metric, controls color scheme in metrics mode */
  metricsType?: ObsColumnType;
  onSelectionChange?: (ids: (number | string)[]) => void;
  /** Called when exactly one point is clicked/tapped. Return false to allow event propagation. */
  onQuickSelect?: (id: string) => boolean | void;
  /** Called when lasso painting starts */
  onLassoStart?: () => void;
  /** Called when lasso painting ends */
  onLassoEnd?: () => void;
  flipX?: boolean;
  flipY?: boolean;
  /** Bring colored points to front (render on top of unpainted points) */
  colorsToFront?: boolean;
  /** Enable animation testing between projection sets */
  testAnimation?: boolean;
  /** Kedro base URL for fetching pipeline data */
  kedroBaseUrl?: string;
  /** Filter for pipeline options (e.g., "bestkmeans") */
  pipelineFilter?: string;
  /** Available pipelines for switching */
  availablePipelines?: Array<{id: string, name: string}>;
  /** Called when pipeline changes in the selector */
  onPipelineChange?: (pipelineId: string) => void;
  /** Preloaded pipeline data (e.g. from h5ad file) — bypasses fetch-based loading */
  preloadedPipelineData?: Record<string, [string, [number, number]][] | null>;
  /** Callback to trigger loading a new file (shown as button in MapProjectionSelector) */
  onLoadFile?: () => void;
};

const PREFERRED_KEDRO_PIPELINE = 'mean_localmap_bestkmeans';

export const D3Map: React.FC<D3MapProps> = ({
  data,
  mode = "move",
  pointColors = [],
  palette = PALETTE_COLORS,
  layerMode = "groups",
  metricsType = "continuous",
  onSelectionChange,
  onQuickSelect,
  onLassoStart,
  onLassoEnd,
  flipX,
  flipY,
  colorsToFront = false,
  testAnimation = false,
  kedroBaseUrl,
  pipelineFilter,
  availablePipelines = [],
  onPipelineChange,
  preloadedPipelineData,
  onLoadFile,
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const lassoRectRef = React.useRef<SVGRectElement | null>(null);
  const modeRef = React.useRef(mode);
  const lassoStateRef = React.useRef<{
    path: d3.Selection<SVGPathElement, unknown, null, undefined> | null;
    coords: [number, number][];
    cleanup: (() => void) | null;
  }>({ path: null, coords: [], cleanup: null });
  React.useEffect(() => { modeRef.current = mode; }, [mode]);

  // Mode helpers - Kedro is default unless kedroBaseUrl isn't set
  const isStaticMode = !kedroBaseUrl;
  const isKedroMode = !isStaticMode;

  // Animation state
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Unified pipeline data state - works for both Kedro and static projections
  const [pipelineData, setPipelineData] = React.useState<Record<string, ProjectionData | null>>({});
  const [selectedPipeline, setSelectedPipeline] = React.useState<string>('');
  const [previousPipeline, setPreviousPipeline] = React.useState<string>('');

  // Static projections as pipeline options
  const staticPipelines = React.useMemo(() => [
    { id: 'localmap', name: 'LocalMAP' },
    { id: 'pacmap', name: 'PaCMAP' },
    { id: 'umap', name: 'UMAP' }
  ], []);

  // Kedro pipeline options - use internal pipeline fetching if availablePipelines not provided
  const shouldFetchKedroOptions = isKedroMode && testAnimation && !availablePipelines?.length;
  const { pipelines: fetchedKedroOptions } = usePipelineOptions(
    shouldFetchKedroOptions ? kedroBaseUrl : undefined,
    pipelineFilter || 'bestkmeans'
  );
  const kedroOptions = availablePipelines?.length ? availablePipelines : fetchedKedroOptions;

  // Preloaded pipeline options derived from preloadedPipelineData keys
  const preloadedPipelineOptions = React.useMemo(() => {
    if (!preloadedPipelineData) return [];
    return Object.keys(preloadedPipelineData).map(id => ({ id, name: id }));
  }, [preloadedPipelineData]);

  // Current pipeline options based on mode
  const currentPipelineOptions = preloadedPipelineData ? preloadedPipelineOptions : isKedroMode ? kedroOptions : staticPipelines;

  // Auto-cycling state
  const [isAutoCycling, setIsAutoCycling] = React.useState(false);

  // State to trigger re-calculation of radius on resize
  const [resizeCounter, forceUpdate] = React.useReducer(x => x + 1, 0);

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

  // Handle window resize to update radius (with throttling)
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        forceUpdate(); // Trigger re-calculation of BASE_RADIUS
      }, 100); // Throttle to avoid excessive updates
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Load projection data only if testAnimation is enabled
  React.useEffect(() => {
    if (!testAnimation) return;

    // If preloaded pipeline data is provided, use it directly
    if (preloadedPipelineData) {
      setPipelineData(preloadedPipelineData);
      return;
    }

    const loadProjections = async () => {
      try {
        if (isKedroMode && kedroOptions.length > 0) {
          // Load pipeline data from Kedro API
          const { fetchAndProcessKedroData } = await import('../../lib/kedro-api');
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
          // Load static projection files
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

          // Sort all projection data by participant ID to ensure consistent ordering
          const sortByParticipantId = (data: [string, [number, number]][]) =>
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
  }, [testAnimation, isKedroMode, kedroOptions, preloadedPipelineData]);

  // Calculate responsive base radius directly in JavaScript
  const BASE_RADIUS = React.useMemo(() => {
    const screenWidth = window.innerWidth;
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Define breakpoints and corresponding radius multipliers
    // Mobile (≤480px) is the baseline (original size)
    let radiusMultiplier: number;
    if (screenWidth <= 480) {
      radiusMultiplier = 1.0; // Mobile: original baseline size
    } else if (screenWidth <= 768) {
      radiusMultiplier = 1.2; // Tablet: slightly larger
    } else if (screenWidth <= 1200) {
      radiusMultiplier = 1.4; // Desktop: larger
    } else {
      radiusMultiplier = 1.6; // Large desktop: largest
    }

    return radiusMultiplier * devicePixelRatio;
  }, [resizeCounter]); // Re-calculate when resizeCounter changes (on resize)

  // --- Color scale for continuous metrics mode ---
  const continuousColorScale = React.useMemo(() => createContinuousScale(), []);

  // --- Color helper function ---
  const getPointColor = React.useCallback((colorValue: number | null) => {
    if (layerMode === "metrics") {
      if (colorValue == null) {
        return HIDE_NULL_POINTS ? NULL_COLOR : NULL_COLOR;
      }
      switch (metricsType) {
        case "boolean":
          return colorValue ? BOOLEAN_COLORS.true : BOOLEAN_COLORS.false;
        case "categorical":
          return getCategoricalColor(colorValue);
        case "continuous":
        default:
          return continuousColorScale(colorValue);
      }
    }

    if (colorValue == null) {
      return UNPAINTED_COLOR;
    }

    // For groups/votes mode, treat colorValue as palette index
    return palette[colorValue % palette.length];
  }, [layerMode, metricsType, palette, continuousColorScale]);

  // --- Point opacity helper for null hiding in metrics mode ---
  const getPointOpacity = React.useCallback((colorValue: number | null) => {
    if (FEATURE_HIDE_NULL_METRICS && layerMode === "metrics" && colorValue == null && HIDE_NULL_POINTS) {
      return 0;
    }
    return 0.9;
  }, [layerMode]);

  // --- Prepare points and scales ---
  const { points, xScale, yScale } = React.useMemo(() => {
    // Use projection data if testAnimation is enabled and data is available, otherwise fall back to original data
    let currentData = data;

    if (testAnimation && selectedPipeline && pipelineData[selectedPipeline]) {
      // Use pipeline data (works for both Kedro and static)
      currentData = pipelineData[selectedPipeline]!;
    }

    const xExtent = d3.extent(currentData, ([, [x]]) => x)! as [number, number];
    const yExtent = d3.extent(currentData, ([, [, y]]) => y)! as [number, number];

    let points = currentData.map(([i, [x, y]], originalIndex) => ({
      i,
      x: flipX ? xExtent[1] - (x - xExtent[0]) : x,
      y: flipY ? yExtent[1] - (y - yExtent[0]) : y,
      originalIndex, // Store original index to preserve order when toggle is off
    }));

    // Sort points to bring colored ones to front if colorsToFront is enabled
    if (colorsToFront) {
      points = [...points].sort((a, b) => {
        const aColorIndex = pointColors[a.originalIndex];
        const bColorIndex = pointColors[b.originalIndex];
        // Handle both null (votes mode) and UNPAINTED_VALUE (groups mode) as unpainted
        const aIsColored = aColorIndex != null && aColorIndex !== UNPAINTED_VALUE;
        const bIsColored = bColorIndex != null && bColorIndex !== UNPAINTED_VALUE;

        // If both are colored or both are uncolored, maintain original order
        if (aIsColored === bIsColored) {
          return a.originalIndex - b.originalIndex;
        }

        // Uncolored points come first (render behind), colored points come last (render on top)
        return aIsColored ? 1 : -1;
      });
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = 20;

    const dataWidth = xExtent[1] - xExtent[0];
    const dataHeight = yExtent[1] - yExtent[0];
    const dataAspect = dataWidth / dataHeight;
    const screenWidth = width - 2 * margin;
    const screenHeight = height - 2 * margin;
    const screenAspect = screenWidth / screenHeight;

    let xRange: [number, number], yRange: [number, number];
    if (dataAspect > screenAspect) {
      const scaledHeight = screenWidth / dataAspect;
      const yOffset = (screenHeight - scaledHeight) / 2;
      xRange = [margin, width - margin];
      yRange = [height - margin - yOffset, margin + yOffset];
    } else {
      const scaledWidth = screenHeight * dataAspect;
      const xOffset = (screenWidth - scaledWidth) / 2;
      xRange = [margin + xOffset, width - margin - xOffset];
      yRange = [height - margin, margin];
    }

    const xScale = d3.scaleLinear().domain(xExtent).range(xRange);
    const yScale = d3.scaleLinear().domain(yExtent).range(yRange);

    return { points, xScale, yScale };
  }, [data, flipX, flipY, colorsToFront, pointColors, testAnimation, pipelineData, selectedPipeline]);

  const quadtree = React.useMemo(
    () => d3.quadtree(points, d => d.x, d => d.y),
    [points]
  );

  // --- Initialize SVG & container ---
  React.useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);

    // Add outline filter definition (feMorphology dilate — much cheaper than blur)
    if (!svg.select("defs#shadow-defs").node()) {
      const defs = svg.append("defs").attr("id", "shadow-defs");
      const filter = defs.append("filter")
        .attr("id", "clusterOutline")
        .attr("x", "-5%").attr("y", "-5%")
        .attr("width", "110%").attr("height", "110%");
      filter.append("feMorphology")
        .attr("in", "SourceAlpha")
        .attr("operator", "dilate")
        .attr("radius", OUTLINE_RADIUS)
        .attr("result", "expanded");
      filter.append("feFlood")
        .attr("flood-color", "#000")
        .attr("flood-opacity", OUTLINE_OPACITY)
        .attr("result", "color");
      filter.append("feComposite")
        .attr("in", "color")
        .attr("in2", "expanded")
        .attr("operator", "in")
        .attr("result", "outline");
      const merge = filter.append("feMerge");
      merge.append("feMergeNode").attr("in", "outline");
      merge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    if (!containerRef.current) {
      containerRef.current = svg.append("g").attr("filter", "url(#clusterOutline)");
    }
  }, []);

  // --- Draw / update circles with animation ---
  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    (container as any).xScale = xScale;
    (container as any).yScale = yScale;

    // Force complete re-render when colorsToFront changes or when pointColors change while sorted
    // Use a unique selector that includes a hash of the pointColors to force re-render when vote data changes
    const pointColorsHash = pointColors.slice(0, 100).join(','); // Sample first 100 for performance
    const circleSelector = colorsToFront ? `circle.sorted-${pointColorsHash.length}` : "circle.original";
    const circles = container.selectAll<SVGCircleElement, typeof points[0]>(circleSelector)
      .data(points, (d: any) => d.i);

    let transformK: any = null
    if (FEATURE_SCALE_RADIUS_ON_ZOOM) {
      const transform = d3.zoomTransform(svgRef.current!);
      transformK = transform.k;
    } else {
      transformK = 1;
    }

    // UPDATE with animation
    const updateSelection = circles
      .attr("r", BASE_RADIUS / transformK)
      .attr("fill", (d) => {
        const colorValue = pointColors[d.originalIndex];
        return getPointColor(colorValue);
      });
    if (FEATURE_HIDE_NULL_METRICS) {
      updateSelection.attr("opacity", (d) => getPointOpacity(pointColors[d.originalIndex]));
    }

    if (isAnimating) {
      if (OUTLINE_SUSPEND_DURING_ANIMATION) container.attr("filter", null);

      const transition = updateSelection
        .transition()
        .duration(1000)
        .ease(d3.easeQuadInOut)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));

      // Use transition.end() promise to properly handle when all animations complete
      transition.end().then(() => {
        setIsAnimating(false);
        if (OUTLINE_SUSPEND_DURING_ANIMATION) container.attr("filter", "url(#clusterOutline)");
      }).catch(() => {
        // Handle case where transition is interrupted
        setIsAnimating(false);
        if (OUTLINE_SUSPEND_DURING_ANIMATION) container.attr("filter", "url(#clusterOutline)");
      });
    } else {
      updateSelection
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));
    }

    // ENTER
    circles.enter()
      .append("circle")
      .attr("class", colorsToFront ? `sorted-${pointColorsHash.length}` : "original")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", BASE_RADIUS / transformK)
      .attr("fill", (d) => {
        const colorValue = pointColors[d.originalIndex];
        return getPointColor(colorValue);
      })
      .attr("opacity", FEATURE_HIDE_NULL_METRICS
        ? (d) => getPointOpacity(pointColors[d.originalIndex])
        : 0.9);

    // EXIT
    circles.exit().remove();

    // When colorsToFront changes or pointColors change, remove all circles with different classes
    if (colorsToFront) {
      container.selectAll("circle.original").remove();
      // Also remove any old sorted circles with different hash
      container.selectAll("circle[class^='sorted-']:not(.sorted-" + pointColorsHash.length + ")").remove();
    } else {
      container.selectAll("circle[class^='sorted-']").remove();
    }
  }, [points, xScale, yScale, pointColors, palette, isAnimating, colorsToFront, BASE_RADIUS]);

  // Update existing circle radii when BASE_RADIUS changes
  React.useEffect(() => {
    if (!containerRef.current) return;

    const transform = d3.zoomTransform(svgRef.current!);
    const transformK = FEATURE_SCALE_RADIUS_ON_ZOOM ? transform.k : 1;

    containerRef.current.selectAll("circle")
      .attr("r", BASE_RADIUS / transformK);
  }, [BASE_RADIUS]);

  // Handle pipeline change with animation (works for both Kedro and static)
  const handlePipelineChange = React.useCallback((newPipeline: string) => {
    if (!testAnimation || !pipelineData[newPipeline] || isAnimating || newPipeline === selectedPipeline) return;

    setIsAnimating(true);
    setPreviousPipeline(selectedPipeline);
    setSelectedPipeline(newPipeline);

    // Notify parent component about pipeline change
    onPipelineChange?.(newPipeline);
  }, [testAnimation, pipelineData, isAnimating, selectedPipeline, onPipelineChange]);

  // Handle toggle between current and previous pipeline
  const handleTogglePipeline = React.useCallback(() => {
    if (!testAnimation || !previousPipeline || !pipelineData[previousPipeline] || isAnimating) return;
    setIsAnimating(true);
    const temp = selectedPipeline;
    setSelectedPipeline(previousPipeline);
    setPreviousPipeline(temp);

    // Notify parent component about pipeline change
    onPipelineChange?.(previousPipeline);
  }, [testAnimation, previousPipeline, pipelineData, isAnimating, selectedPipeline, onPipelineChange]);

  // Auto-cycling logic - trigger next cycle when animation completes
  React.useEffect(() => {
    if (isAutoCycling && previousPipeline && !isAnimating) {
      // Start the next cycle immediately when animation completes
      const timeoutId = setTimeout(() => {
        handleTogglePipeline();
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [isAutoCycling, previousPipeline, isAnimating, handleTogglePipeline]);

  // Handle auto-cycle toggle
  const handleAutoCycleToggle = React.useCallback(() => {
    if (isAutoCycling) {
      // Stop auto-cycling - let current cycle complete
      setIsAutoCycling(false);
    } else {
      // Start auto-cycling if we have a previous pipeline
      if (previousPipeline && pipelineData[previousPipeline]) {
        setIsAutoCycling(true);
      }
    }
  }, [isAutoCycling, previousPipeline, pipelineData]);

  // --- Zoom behavior (pan/zoom only) ---
  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 15])
      .filter((event) => {
        /**
         * Here's what we do for every zoom event:
         * - all wheel events = YES, in any mode
         * - all multi-touch pinch events = YES, in any mode
         * - single-touch event = YES, in move mode
         * - otherwise, NO, ignore event, because we're painting.
         */
        if (event.type === "wheel") return true;
        if (event.type.startsWith("touch")) {
          const touches = event.touches?.length ?? 0;
          if (touches >= 2) return true; // pinch zoom
          if (touches === 1 && modeRef.current === "move") return true; // single-finger pan
          return false;
        }
        return modeRef.current === "move";
      })
      .on("start", (event) => {
        // Clean up lasso when zoom starts (especially for multi-touch)
        if (event.sourceEvent && event.sourceEvent.type.startsWith("touch")) {
          const touches = event.sourceEvent.touches?.length ?? 0;
          if (touches >= 2 && lassoStateRef.current.cleanup) {
            console.log('🔍 Zoom start detected with multi-touch, cleaning up lasso');
            lassoStateRef.current.cleanup();
          }
        }
      })
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
        const k = FEATURE_SCALE_RADIUS_ON_ZOOM ? event.transform.k : 1;
        container.selectAll("circle").attr("r", BASE_RADIUS / k);
        // Scale outline radius with zoom so it stays proportional to circle size
        svg.select("#clusterOutline feMorphology").attr("radius", OUTLINE_RADIUS / k);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity);
  }, []);

  // --- Simple click/tap detection for quick select (works in both modes) ---
  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);

    let startPos: [number, number] | null = null;
    let startTime = 0;

    const handlePointerDown = (event: PointerEvent) => {
      startPos = [event.clientX, event.clientY];
      startTime = Date.now();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!startPos) return;

      const dx = event.clientX - startPos[0];
      const dy = event.clientY - startPos[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - startTime;

      // Consider it a click/tap if movement is small and duration is short
      const isClick = distance < 10 && duration < 500;

      if (isClick) {
        console.log('🎯 Click/tap detected - mode:', mode);

        const [sx, sy] = d3.pointer(event, svg.node()!);
        const transform = d3.zoomTransform(containerRef.current!.node()!);
        const x = xScale.invert(transform.invertX(sx));
        const y = yScale.invert(transform.invertY(sy));
        const radius = xScale.invert(5) - xScale.invert(0);
        const p = quadtree.find(x, y, radius);

        if (p) {
          console.log('🎯 Quick select found point:', p.i);

          // Call the quick select callback
          const shouldPreventDefault = onQuickSelect?.(p.i);

          // Only prevent default if quick select was processed
          if (shouldPreventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }

      // Reset tracking
      startPos = null;
      startTime = 0;
    };

    const svgNode = svg.node();
    if (!svgNode) return;

    svgNode.addEventListener("pointerdown", handlePointerDown, true);
    svgNode.addEventListener("pointerup", handlePointerUp, true);

    return () => {
      svgNode.removeEventListener("pointerdown", handlePointerDown, true);
      svgNode.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [mode, xScale, yScale, quadtree, onSelectionChange, onQuickSelect]);

  // --- Lasso painting ---
  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;

    // 🟢 Clean up any previous lasso drag when mode changes
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

      // Store cleanup function in ref so zoom can access it
      lassoStateRef.current.cleanup = cleanupLasso;

      function lassoStart(event: any) {
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

      function lassoDrag(event: any) {
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
          cleanupLasso(true); // End cycling and cleanup
          return;
        }
        const transform = d3.zoomTransform(container.node()!);
        const circles = container.selectAll("circle");
        const selected = circles.data().filter((d: any) => {
          const sx = transform.applyX((container as any).xScale(d.x));
          const sy = transform.applyY((container as any).yScale(d.y));
          return pointInPolygon([sx, sy], lassoStateRef.current.coords);
        });
        if (onSelectionChange) onSelectionChange(selected.map((d: any) => d.i));

        cleanupLasso(true); // End cycling and cleanup
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

      // Cleanup function when mode changes
      return () => {
        cleanupLasso(true); // End cycling when mode changes
        lassoStateRef.current.cleanup = null;
      };
    } else {
      // Clear cleanup function when not in paint mode
      lassoStateRef.current.cleanup = null;
    }
  }, [mode, onSelectionChange, xScale, yScale, onLassoStart, onLassoEnd]);

  // --- Update colors on pointColors or palette change ---
  React.useEffect(() => {
    if (!containerRef.current) return;
    // Update colors for all circles regardless of class
    containerRef.current.selectAll("circle")
      .attr("fill", (d: any) => {
        const colorValue = pointColors[d.originalIndex];
        return getPointColor(colorValue);
      })
      .attr("opacity", FEATURE_HIDE_NULL_METRICS
        ? (d: any) => getPointOpacity(pointColors[d.originalIndex])
        : 0.9);
  }, [pointColors, palette, layerMode, getPointColor, getPointOpacity]);

  function pointInPolygon([x, y]: [number, number], vs: [number, number][]) {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const [xi, yi] = vs[i], [xj, yj] = vs[j];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  return (
    <div className="relative w-screen h-screen">
      <svg ref={svgRef} className="w-screen h-screen block bg-gray-100" />

      {/* Pipeline Selector - unified for both Kedro and static projections */}
      {testAnimation && currentPipelineOptions.length > 0 && Object.values(pipelineData).some(data => data !== null) ? (
        <MapProjectionSelector
          availablePipelines={currentPipelineOptions}
          selectedPipeline={selectedPipeline}
          onPipelineChange={handlePipelineChange}
          enableAnimation={testAnimation}
          previousPipeline={previousPipeline}
          onTogglePipeline={handleTogglePipeline}
          isAutoCycling={isAutoCycling}
          onToggleAutoCycle={handleAutoCycleToggle}
          isAnimating={isAnimating}
          pipelineLoadingStates={Object.fromEntries(
            currentPipelineOptions.map(p => [p.id, !pipelineData[p.id]])
          )}
          onLoadFile={onLoadFile}
          top="1rem"
          left="1rem"
        />
      ) : onLoadFile && (
        <div className="absolute flex items-center gap-1" style={{ top: '1rem', left: '1rem' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadFile}
            title="Import .h5ad file"
            className="bg-white/90 backdrop-blur-sm shadow-sm"
          >
            <Import className="h-4 w-4 mr-1" />
            Import .h5ad
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-white/90 backdrop-blur-sm shadow-sm"
            title="How to export .h5ad files"
            asChild
          >
            <a href="https://valency-anndata-export-test.streamlit.app/" target="_blank" rel="noopener noreferrer">
              <Info className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

    </div>
  );
};
