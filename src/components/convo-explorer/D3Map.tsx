"use client";

import * as React from "react";
import * as d3 from "d3";
import { PALETTE_COLORS, UNPAINTED_COLOR, UNPAINTED_VALUE, OUTLINE_RADIUS, OUTLINE_OPACITY, OUTLINE_SUSPEND_DURING_ANIMATION } from "@/constants";
import type { ObsColumnType } from "@/lib/color-schemes";
import { BOOLEAN_COLORS, NULL_COLOR, createContinuousScale, getAnnotationCategoricalColor } from "@/lib/color-schemes";
import { usePipelineOptions } from "../../../.storybook/hooks/usePipelineOptions";
import { MapProjectionSelector } from "./MapProjectionSelector";
import { Button } from "../ui/button";
import { FileDown, Import, Info } from "lucide-react";

type ProjectionData = [string, [number, number]][];


const FEATURE_SCALE_RADIUS_ON_ZOOM = true;
const MIN_CIRCLE_RADIUS = 0.5; // prevent sub-pixel circles that vanish on mobile

type D3MapProps = {
  /** Dataset points in the format [[i, [x, y]], ...] */
  data: [string, [number, number]][];
  mode?: "move" | "paint" | "spotlight";
  /** Radius in SVG pixels for the spotlight selection circle (spotlight mode only) */
  spotlightRadius?: number;
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
  /** Extra projections computed in-browser (e.g. via DruidJS) — merged into pipeline options */
  extraPipelineData?: Record<string, [string, [number, number]][]>;
  /** Callback to open the recompute-projection dialog (shown as button in MapProjectionSelector) */
  onRecomputeProjection?: () => void;
  /** Callback to trigger loading a new file (shown as button in MapProjectionSelector) */
  onLoadFile?: () => void;
  /** Callback to trigger downloading participant data as CSV */
  onDownloadObsCsv?: () => void;
  /** Live intermediate coordinates from an in-progress reduction — overrides data and pipeline selection when set. */
  liveData?: [string, [number, number]][];
  /** Display mask parallel to data: true = visible, false = hidden. When undefined, all points visible. */
  displayMask?: boolean[];
  /** Color for unpainted points in groups mode. Defaults to UNPAINTED_COLOR (black). */
  unpaintedColor?: string;
  /** When true, the spotlight circle stays in place after all fingers lift; the next touch moves it again (spotlight mode only) */
  spotlightPersist?: boolean;
  /** Called whenever the spotlight radius changes internally (wheel or pinch), so the parent can sync a slider.
   *  Primarily useful for Storybook/debug UIs — likely not needed in the app itself. */
  onSpotlightRadiusChange?: (radius: number) => void;
  /** Debug callback fired on every spotlight touch/pointer event with internal state (spotlight mode only) */
  onSpotlightDebug?: (state: { event: string; touchCount: number; currentRadius: number; cx: number; cy: number; grabOffsetX: number; grabOffsetY: number }) => void;
};

const PREFERRED_KEDRO_PIPELINE = 'mean_localmap_bestkmeans';

function isTap(dx: number, dy: number, durationMs: number, maxDist = 10, maxMs = 500) {
  return Math.hypot(dx, dy) < maxDist && durationMs < maxMs;
}

/**
 * Decides whether D3 zoom should handle a given event.
 * Spotlight mode registers its own wheel/touch listeners and handles everything itself,
 * so D3 zoom must yield. For other modes: wheel always zooms, pinch always zooms,
 * single-touch only pans in move mode.
 */
function zoomEventFilter(event: Event, mode: string): boolean {
  if (mode === "spotlight") return false;
  if (event.type === "wheel") return true;
  if (event.type.startsWith("touch")) {
    const touches = (event as TouchEvent).touches?.length ?? 0;
    if (touches >= 2) return true;
    if (touches === 1 && mode === "move") return true;
    return false;
  }
  return mode === "move";
}

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
  extraPipelineData,
  onRecomputeProjection,
  onLoadFile,
  onDownloadObsCsv,
  liveData,
  displayMask,
  unpaintedColor = UNPAINTED_COLOR,
  spotlightRadius = 60,
  spotlightPersist = false,
  onSpotlightRadiusChange,
  onSpotlightDebug,
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const lassoRectRef = React.useRef<SVGRectElement | null>(null);
  const modeRef = React.useRef(mode);
  const zoomRef = React.useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Spotlight: mutable touch state lives in a ref so it survives effect re-runs
  const spotlightStateRef = React.useRef({
    currentRadius: spotlightRadius,
    currentCx: -9999,
    currentCy: -9999,
    persist: spotlightPersist,
    // single-touch grab: offset from circle center to touch landing point
    grabOffsetX: 0,
    grabOffsetY: 0,
    // two-touch transform: previous SVG positions keyed by touch identifier
    touchPrevPositions: new Map<number, [number, number]>(),
    // desktop click-to-lock / mobile tap-to-lock: when true, pointer move/leave are ignored
    mouseLocked: false,
    // tap detection: track single-touch start so touchend can detect a quick tap
    tapStartTime: 0,
    tapStartPos: null as [number, number] | null,
  });
  // Keep callback refs so spotlight effect doesn't re-run when they change identity
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  const onSpotlightDebugRef = React.useRef(onSpotlightDebug);
  const onSpotlightRadiusChangeRef = React.useRef(onSpotlightRadiusChange);
  const displayMaskRef = React.useRef(displayMask);
  React.useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  React.useEffect(() => { onSpotlightDebugRef.current = onSpotlightDebug; }, [onSpotlightDebug]);
  React.useEffect(() => { onSpotlightRadiusChangeRef.current = onSpotlightRadiusChange; }, [onSpotlightRadiusChange]);
  React.useEffect(() => { displayMaskRef.current = displayMask; }, [displayMask]);
  // Tracks whether the most recent spotlightRadius change was reported outward by a gesture.
  // If so, the sync effect must not write back — doing so would overwrite a newer gesture value.
  const radiusFromGestureRef = React.useRef(false);
  // Sync prop values into state ref without re-running the spotlight effect
  React.useEffect(() => {
    if (radiusFromGestureRef.current) { radiusFromGestureRef.current = false; return; }
    spotlightStateRef.current.currentRadius = spotlightRadius;
  }, [spotlightRadius]);
  React.useEffect(() => { spotlightStateRef.current.persist = spotlightPersist; }, [spotlightPersist]);
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

  // Preloaded pipeline options derived from preloadedPipelineData keys,
  // plus any projections recomputed in-browser
  const preloadedPipelineOptions = React.useMemo(() => {
    if (!preloadedPipelineData) return [];
    const keys = [
      ...Object.keys(preloadedPipelineData),
      ...Object.keys(extraPipelineData ?? {}),
    ];
    return keys.map(id => ({ id, name: id }));
  }, [preloadedPipelineData, extraPipelineData]);

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
    // (merged with any projections recomputed in-browser)
    if (preloadedPipelineData) {
      setPipelineData({ ...preloadedPipelineData, ...extraPipelineData });
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
  }, [testAnimation, isKedroMode, kedroOptions, preloadedPipelineData, extraPipelineData]);

  // Auto-select a freshly recomputed projection when it first appears
  const prevExtraKeysRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    const keys = Object.keys(extraPipelineData ?? {});
    const added = keys.find(k => !prevExtraKeysRef.current.includes(k));
    prevExtraKeysRef.current = keys;
    if (added) {
      setSelectedPipeline(prev => {
        setPreviousPipeline(prev);
        return added;
      });
      onPipelineChange?.(added);
    }
  }, [extraPipelineData, onPipelineChange]);

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

  // Ref so the zoom handler always reads the current radius without re-registering
  const baseRadiusRef = React.useRef(BASE_RADIUS);
  React.useEffect(() => { baseRadiusRef.current = BASE_RADIUS; }, [BASE_RADIUS]);

  // --- Color scale for continuous metrics mode ---
  const continuousColorScale = React.useMemo(() => createContinuousScale(), []);

  // --- Color helper function ---
  const getPointColor = React.useCallback((colorValue: number | null) => {
    if (layerMode === "metrics") {
      if (colorValue == null) {
        return NULL_COLOR;
      }
      switch (metricsType) {
        case "boolean":
          return colorValue ? BOOLEAN_COLORS.true : BOOLEAN_COLORS.false;
        case "categorical":
          return getAnnotationCategoricalColor(colorValue);
        case "continuous":
        default:
          return continuousColorScale(colorValue);
      }
    }

    if (colorValue == null || colorValue === UNPAINTED_VALUE) {
      return unpaintedColor;
    }

    // For groups/votes mode, treat colorValue as palette index
    return palette[colorValue % palette.length];
  }, [layerMode, metricsType, palette, continuousColorScale, unpaintedColor]);

  // --- Point opacity helper for display mask ---
  const getPointOpacity = React.useCallback((index: number) => {
    if (displayMask && !displayMask[index]) return 0;
    return 1;
  }, [displayMask]);

  // --- Prepare points and scales ---
  const { points, xScale, yScale } = React.useMemo(() => {
    // liveData (in-progress reduction) takes precedence over everything else
    let currentData = liveData ?? data;

    if (!liveData && testAnimation && selectedPipeline && pipelineData[selectedPipeline]) {
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
  }, [liveData, data, flipX, flipY, colorsToFront, pointColors, testAnimation, pipelineData, selectedPipeline]);

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
    if (OUTLINE_RADIUS > 0 && !svg.select("defs#shadow-defs").node()) {
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
      const g = svg.append("g");
      if (OUTLINE_RADIUS > 0) g.attr("filter", "url(#clusterOutline)");
      containerRef.current = g;
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
      .attr("r", Math.max(BASE_RADIUS / transformK, MIN_CIRCLE_RADIUS))
      .attr("fill", (d) => {
        const colorValue = pointColors[d.originalIndex];
        return getPointColor(colorValue);
      })
      .attr("opacity", displayMask
        ? (d) => getPointOpacity(d.originalIndex)
        : 1);

    if (isAnimating) {
      if (OUTLINE_RADIUS > 0 && OUTLINE_SUSPEND_DURING_ANIMATION) container.attr("filter", null);

      const transition = updateSelection
        .transition()
        .duration(1000)
        .ease(d3.easeQuadInOut)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));

      // Use transition.end() promise to properly handle when all animations complete
      transition.end().then(() => {
        setIsAnimating(false);
        if (OUTLINE_RADIUS > 0 && OUTLINE_SUSPEND_DURING_ANIMATION) container.attr("filter", "url(#clusterOutline)");
      }).catch(() => {
        // Handle case where transition is interrupted
        setIsAnimating(false);
        if (OUTLINE_RADIUS > 0 && OUTLINE_SUSPEND_DURING_ANIMATION) container.attr("filter", "url(#clusterOutline)");
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
      .attr("r", Math.max(BASE_RADIUS / transformK, MIN_CIRCLE_RADIUS))
      .attr("fill", (d) => {
        const colorValue = pointColors[d.originalIndex];
        return getPointColor(colorValue);
      })
      .attr("opacity", displayMask
        ? (d) => getPointOpacity(d.originalIndex)
        : 1);

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
  }, [points, xScale, yScale, pointColors, palette, isAnimating, colorsToFront, BASE_RADIUS, displayMask, getPointOpacity]);

  // Update existing circle radii when BASE_RADIUS changes
  React.useEffect(() => {
    if (!containerRef.current) return;

    const transform = d3.zoomTransform(svgRef.current!);
    const transformK = FEATURE_SCALE_RADIUS_ON_ZOOM ? transform.k : 1;

    containerRef.current.selectAll("circle")
      .attr("r", Math.max(BASE_RADIUS / transformK, MIN_CIRCLE_RADIUS));
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
      .filter((event) => zoomEventFilter(event, modeRef.current))
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
        container.selectAll("circle").attr("r", Math.max(baseRadiusRef.current / k, MIN_CIRCLE_RADIUS));
        // Scale outline radius with zoom so it stays proportional to circle size
        if (OUTLINE_RADIUS > 0) svg.select("#clusterOutline feMorphology").attr("radius", OUTLINE_RADIUS / k);
      });

    zoomRef.current = zoom;
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
      const duration = Date.now() - startTime;

      const isClick = isTap(dx, dy, duration);

      if (isClick) {
        console.log('🎯 Click/tap detected - mode:', mode);

        const [sx, sy] = d3.pointer(event, svg.node()!);
        const transform = d3.zoomTransform(containerRef.current!.node()!);
        const x = xScale.invert(transform.invertX(sx));
        const y = yScale.invert(transform.invertY(sy));
        const radius = xScale.invert(5) - xScale.invert(0);
        const p = quadtree.find(x, y, radius);

        if (p) {
          // Skip masked points
          if (displayMask && !displayMask[p.originalIndex]) {
            startPos = null;
            startTime = 0;
            return;
          }

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
  }, [mode, xScale, yScale, quadtree, onSelectionChange, onQuickSelect, displayMask]);

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
          if (displayMask && !displayMask[d.originalIndex]) return false;
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
  }, [mode, onSelectionChange, xScale, yScale, onLassoStart, onLassoEnd, displayMask]);

  // --- Spotlight mode ---
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
      const selected = (container.selectAll("circle").data() as any[]).filter((d: any) => {
        if (displayMaskRef.current && !displayMaskRef.current[d.originalIndex]) return false;
        const sx = transform.applyX((container as any).xScale(d.x));
        const sy = transform.applyY((container as any).yScale(d.y));
        return Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2) <= radius;
      });
      onSelectionChangeRef.current?.(selected.map((d: any) => d.i));
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

  // --- Update colors on pointColors or palette change ---
  React.useEffect(() => {
    if (!containerRef.current) return;
    // Update colors for all circles regardless of class
    containerRef.current.selectAll("circle")
      .attr("fill", (d: any) => {
        const colorValue = pointColors[d.originalIndex];
        return getPointColor(colorValue);
      })
      .attr("opacity", displayMask
        ? (d: any) => getPointOpacity(d.originalIndex)
        : 1);
  }, [pointColors, palette, layerMode, getPointColor, getPointOpacity, displayMask, unpaintedColor]);

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
          onDownloadObsCsv={onDownloadObsCsv}
          onRecomputeProjection={onRecomputeProjection}
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
          {onDownloadObsCsv && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white/90 backdrop-blur-sm shadow-sm"
              title="Download participant data as CSV"
              onClick={onDownloadObsCsv}
            >
              <FileDown className="h-4 w-4" />
            </Button>
          )}
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
