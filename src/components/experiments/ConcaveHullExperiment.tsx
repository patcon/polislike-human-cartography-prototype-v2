"use client";

import * as React from "react";
import * as d3 from "d3";
import concaveman from "concaveman";
import { ClusterSelectionPanel } from './shared/ClusterSelectionPanel';
import { LoadingDisplay } from './shared/LoadingDisplay';
import { ConcaveHullPanel } from './shared/ConcaveHullPanel';
import type { ConcaveHullConfig } from './shared/ConcaveHullConfigModal';

// Configuration constant for segmented cluster view
const SEGMENT_CLUSTERED = true;

type Point = {
  id: string;
  x: number;
  y: number;
  label?: number;
};

type LabelsByThreshold = {
  [threshold: string]: number[];
};

type DisplaySettings = {
  // Remove width/height props since we'll use full screen
};

export const ConcaveHullExperiment: React.FC<DisplaySettings> = () => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  const [points, setPoints] = React.useState<Point[]>([]);
  const [labelsByThreshold, setLabelsByThreshold] = React.useState<LabelsByThreshold>({});
  const [currentLambda, setCurrentLambda] = React.useState(3.0);
  const [autoSelectMode, setAutoSelectMode] = React.useState(true);
  const [expandSelectionMode, setExpandSelectionMode] = React.useState(true);
  const [displayGroupColors, setDisplayGroupColors] = React.useState(false);
  const [selectedPoints, setSelectedPoints] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastSelectedPoint, setLastSelectedPoint] = React.useState<string | null>(null);
  const [hullConfig, setHullConfig] = React.useState<ConcaveHullConfig>({
    enabled: false,
    concavity: 2.0,
    lengthThreshold: 0,
    fillOpacity: 0.75,
    strokeOpacity: 0.6,
    strokeWidth: 2,
    showOnlySelected: false,
    excludeNoise: true,
    renderOrder: 'above'
  });

  const color = d3.scaleOrdinal(d3.schemeTableau10);

  // Load data
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 Starting to load data...');

        const [pointsResponse, labelsResponse] = await Promise.all([
          fetch('/projections.json'),
          fetch('/projection_labels_by_threshold.json')
        ]);

        console.log('📡 Responses received:', {
          pointsStatus: pointsResponse.status,
          labelsStatus: labelsResponse.status
        });

        if (!pointsResponse.ok) {
          throw new Error(`Failed to fetch projections.json: ${pointsResponse.status}`);
        }
        if (!labelsResponse.ok) {
          throw new Error(`Failed to fetch projection_labels_by_threshold.json: ${labelsResponse.status}`);
        }

        const pointsData: [string, [number, number]][] = await pointsResponse.json();
        const labelsData: LabelsByThreshold = await labelsResponse.json();

        console.log('📊 Data loaded:', {
          pointsCount: pointsData.length,
          labelsThresholds: Object.keys(labelsData).length,
          samplePoint: pointsData[0],
          sampleThreshold: Object.keys(labelsData)[0]
        });

        // Convert points data
        const processedPoints: Point[] = pointsData.map(([id, [x, y]]) => ({
          id,
          x,
          y
        }));

        console.log('✅ Processed points:', processedPoints.length);

        setPoints(processedPoints);
        setLabelsByThreshold(labelsData);
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Failed to load data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Find nearest threshold
  const nearestThreshold = React.useCallback((val: number): string => {
    const keys = Object.keys(labelsByThreshold).map(parseFloat);
    const closest = keys.reduce((a, b) => Math.abs(a - val) < Math.abs(b - val) ? a : b);
    return closest.toFixed(2);
  }, [labelsByThreshold]);

  // Calculate scales
  const { xScale, yScale } = React.useMemo(() => {
    if (!points.length) return { xScale: null, yScale: null };

    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = 40;

    const xExtent = d3.extent(points, d => d.x) as [number, number];
    const yExtent = d3.extent(points, d => d.y) as [number, number];

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([margin, width - margin]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - margin, margin]);

    return { xScale, yScale };
  }, [points]);

  // Initialize SVG immediately when ref is available
  React.useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);

    if (!containerRef.current) {
      containerRef.current = svg.append("g");
    }
  });

  // Update SVG dimensions when scales change
  React.useEffect(() => {
    if (!svgRef.current || !xScale || !yScale) return;

    const svg = d3.select(svgRef.current);
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
  }, [xScale, yScale]);

  // Handle background click
  const handleBackgroundClick = React.useCallback(() => {
    console.log("Clicked on background - resetting selection and going to lowest water level");

    // Clear selection
    setSelectedPoints(new Set());
    setLastSelectedPoint(null);

    // Find lowest lambda
    if (Object.keys(labelsByThreshold).length > 0) {
      const thresholds = Object.keys(labelsByThreshold).map(parseFloat);
      const lowestLambda = Math.min(...thresholds);
      setCurrentLambda(lowestLambda);
    }
  }, [labelsByThreshold]);

  // Select cluster
  const selectCluster = React.useCallback((clusterId: number, labels: number[]) => {
    const clusterIndices = labels
      .map((lbl, i) => (lbl === clusterId ? points[i]?.id : null))
      .filter((id): id is string => id !== null);

    setSelectedPoints(new Set(clusterIndices));
  }, [points]);

  // Find optimal lambda for a point (highest lambda where point is not noise)
  const findOptimalLambda = React.useCallback((pointIndex: number): number | null => {
    const thresholds = Object.keys(labelsByThreshold)
      .map(parseFloat)
      .sort((a, b) => b - a); // Sort descending (highest first)

    for (const lambda of thresholds) {
      const threshold = lambda.toFixed(2);
      const labels = labelsByThreshold[threshold];
      const clusterId = labels[pointIndex];

      if (clusterId !== -1) {
        console.log(`Found optimal λ=${lambda.toFixed(2)} for point (cluster ${clusterId})`);
        return lambda;
      }
    }

    return null; // Point is noise at all levels
  }, [labelsByThreshold]);

  // Find next deeper lambda level for progressive drilling
  const findNextDeeperLambda = React.useCallback((pointIndex: number, currentLambda: number): number | null => {
    const thresholds = Object.keys(labelsByThreshold)
      .map(parseFloat)
      .sort((a, b) => b - a); // Sort descending (highest first)

    // Get current cluster size
    const currentThreshold = nearestThreshold(currentLambda);
    const currentLabels = labelsByThreshold[currentThreshold];
    const currentClusterId = currentLabels[pointIndex];

    if (currentClusterId === -1) {
      console.log("Current point is noise, cannot expand cluster");
      return null;
    }

    const currentClusterSize = currentLabels.filter(label => label === currentClusterId).length;
    console.log(`Current cluster size: ${currentClusterSize} points`);

    // Find thresholds lower than current lambda
    const lowerThresholds = thresholds.filter(lambda => lambda < currentLambda);

    for (const lambda of lowerThresholds) {
      const threshold = lambda.toFixed(2);
      const labels = labelsByThreshold[threshold];
      const clusterId = labels[pointIndex];

      if (clusterId !== -1) {
        // Count points in this cluster
        const clusterSize = labels.filter(label => label === clusterId).length;

        // Only return if cluster is larger than current
        if (clusterSize > currentClusterSize) {
          console.log(`Found expanded cluster: λ=${lambda.toFixed(2)}, size ${currentClusterSize} → ${clusterSize} points`);
          return lambda;
        }
      }
    }

    console.log("No larger cluster found at lower lambda levels");
    return null;
  }, [labelsByThreshold, nearestThreshold]);

  // Handle auto-select logic
  const handleAutoSelect = React.useCallback((pointIndex: number, isAlreadySelected: boolean) => {
    let optimalLambda: number | null;

    if (isAlreadySelected) {
      // Progressive drilling: find next deeper level
      optimalLambda = findNextDeeperLambda(pointIndex, currentLambda);
      if (optimalLambda === null) {
        console.log("Already at deepest level for this point");
        return;
      }
      console.log(`Drilling deeper: λ=${currentLambda.toFixed(2)} → λ=${optimalLambda.toFixed(2)}`);
    } else {
      // First selection: find the highest lambda where this point is not noise
      optimalLambda = findOptimalLambda(pointIndex);
      if (optimalLambda === null) {
        console.log("Point is noise at all lambda levels");
        return;
      }
      setLastSelectedPoint(points[pointIndex]?.id || null);
    }

    // Update the lambda and recolor
    setCurrentLambda(optimalLambda);

    // Select the cluster at the new lambda level
    const threshold = nearestThreshold(optimalLambda);
    const labels = labelsByThreshold[threshold];
    const clusterId = labels[pointIndex];
    selectCluster(clusterId, labels);
  }, [currentLambda, findNextDeeperLambda, findOptimalLambda, nearestThreshold, labelsByThreshold, selectCluster, points]);

  // Handle point click
  const handlePointClick = React.useCallback((pointId: string, pointIndex: number) => {
    const threshold = nearestThreshold(currentLambda);
    const labels = labelsByThreshold[threshold];
    if (!labels) return;

    const clusterId = labels[pointIndex];

    // Don't select noise points (cluster ID -1) in manual mode
    if (clusterId === -1 && !autoSelectMode) {
      console.log("Clicked on noise point - not selectable in manual mode");
      return;
    }

    if (autoSelectMode) {
      // Check if we're in expand selection mode and clicked on a selected point
      if (expandSelectionMode && selectedPoints.has(pointId)) {
        const selectedCount = selectedPoints.size;
        const currentThreshold = nearestThreshold(currentLambda);
        const currentLabels = labelsByThreshold[currentThreshold];
        const totalNonNoisePoints = currentLabels.filter(label => label !== -1).length;

        if (selectedCount >= totalNonNoisePoints) {
          // At lowest water level - use original auto-select behavior
          console.log("At lowest water level - using original selection mode");
          handleAutoSelect(pointIndex, false);
        } else {
          // Normal expand selection behavior
          const optimalLambda = findNextDeeperLambda(pointIndex, currentLambda);
          if (optimalLambda === null) {
            console.log("Already at deepest level for this cluster");
            return;
          }

          console.log(`Expanding selection: λ=${currentLambda.toFixed(2)} → λ=${optimalLambda.toFixed(2)}`);
          setCurrentLambda(optimalLambda);

          const threshold = nearestThreshold(optimalLambda);
          const labels = labelsByThreshold[threshold];
          const clusterId = labels[pointIndex];
          selectCluster(clusterId, labels);
        }
        return;
      }

      // Regular auto-select mode
      const isAlreadySelected = lastSelectedPoint === pointId;
      handleAutoSelect(pointIndex, isAlreadySelected);
    } else {
      // Manual mode
      setLastSelectedPoint(null);
      selectCluster(clusterId, labels);
    }
  }, [currentLambda, nearestThreshold, labelsByThreshold, autoSelectMode, expandSelectionMode, selectedPoints, lastSelectedPoint, handleAutoSelect, findNextDeeperLambda, selectCluster]);

  // Generate concave hull for a cluster using concaveman
  const generateConcaveHull = React.useCallback((clusterPoints: Point[]): string => {
    if (clusterPoints.length < 3) return "";

    try {
      // Convert points to screen coordinates
      const screenPoints: [number, number][] = clusterPoints.map(p => [xScale!(p.x), yScale!(p.y)]);

      // Use concaveman to generate concave hull
      // concavity parameter: lower values = more detailed/concave, higher values = more convex
      const concavity = hullConfig.concavity;
      const lengthThreshold = hullConfig.lengthThreshold;

      const hullPoints = concaveman(screenPoints, concavity, lengthThreshold);

      if (!hullPoints || hullPoints.length < 3) {
        // Fallback to convex hull if concaveman fails
        const convexHull = d3.polygonHull(screenPoints as [number, number][]);
        if (!convexHull || convexHull.length < 3) return "";
        return `M${convexHull.map(p => p.join(",")).join("L")}Z`;
      }

      return `M${hullPoints.map(p => p.join(",")).join("L")}Z`;
    } catch (error) {
      console.warn('Concaveman failed, falling back to convex hull:', error);
      // Fallback to convex hull on error
      const fallbackScreenPoints: [number, number][] = clusterPoints.map(p => [xScale!(p.x), yScale!(p.y)]);
      const fallbackHullPoints = d3.polygonHull(fallbackScreenPoints);
      if (!fallbackHullPoints || fallbackHullPoints.length < 3) return "";
      return `M${fallbackHullPoints.map(p => p.join(",")).join("L")}Z`;
    }
  }, [xScale, yScale, hullConfig.concavity, hullConfig.lengthThreshold]);

  // Draw visualization
  React.useEffect(() => {
    if (!containerRef.current || !xScale || !yScale || !points.length || !Object.keys(labelsByThreshold).length) return;

    const container = containerRef.current;
    const currentTransform = d3.zoomTransform(container.node()!);

    // Clear existing elements
    container.selectAll("*").remove();

    const threshold = nearestThreshold(currentLambda);
    const labels = labelsByThreshold[threshold];
    if (!labels) return;

    // Function to draw concave hulls
    const drawHulls = () => {
      if (hullConfig.enabled) {
        const clusterGroups = new Map<number, Point[]>();

        // Group points by cluster (excluding noise if configured)
        points.forEach((point, index) => {
          const clusterId = labels[index];
          if (hullConfig.excludeNoise && clusterId === -1) return;

          // If showOnlySelected is true, only show hulls for selected clusters
          if (hullConfig.showOnlySelected) {
            const isPointSelected = selectedPoints.has(point.id);
            if (!isPointSelected) return;
          }

          if (clusterId !== -1) {
            if (!clusterGroups.has(clusterId)) {
              clusterGroups.set(clusterId, []);
            }
            clusterGroups.get(clusterId)!.push(point);
          }
        });

        // Draw hulls for each cluster
        clusterGroups.forEach((clusterPoints, clusterId) => {
          if (clusterPoints.length >= 3) {
            const hullPath = generateConcaveHull(clusterPoints);
            if (hullPath) {
              container.append("path")
                .attr("d", hullPath)
                .attr("fill", color(clusterId.toString()))
                .attr("fill-opacity", hullConfig.fillOpacity)
                .attr("stroke", color(clusterId.toString()))
                .attr("stroke-width", hullConfig.strokeWidth / currentTransform.k)
                .attr("stroke-opacity", hullConfig.strokeOpacity);
            }
          }
        });
      }
    };

    // Draw hulls below points if configured
    if (hullConfig.renderOrder === 'below') {
      drawHulls();
    }

    // Separate points into selected and unselected for proper z-order
    const unselectedPoints = points.filter(d => !selectedPoints.has(d.id));
    const selectedPointsArray = points.filter(d => selectedPoints.has(d.id));

    // Draw unselected points first (bottom layer)
    container.selectAll(".unselected-point")
      .data(unselectedPoints)
      .enter()
      .append("circle")
      .attr("class", "unselected-point")
      .attr("r", 4 / currentTransform.k)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("fill", (d) => {
        const pointIndex = points.findIndex(p => p.id === d.id);
        const label = labels[pointIndex];

        if (displayGroupColors) {
          if (label === -1) {
            return "#cccccc"; // Gray for noise
          }
          return color(label.toString());
        } else {
          return "#d3d3d3"; // Light gray for unselected
        }
      })
      .attr("opacity", (d) => {
        const pointIndex = points.findIndex(p => p.id === d.id);
        const label = labels[pointIndex];
        if (displayGroupColors) {
          return label === -1 ? 0.4 : 1.0; // Make noise points more transparent
        } else {
          return 1.0;
        }
      })
      .attr("stroke", "#333")
      .attr("stroke-width", (d) => {
        const pointIndex = points.findIndex(p => p.id === d.id);
        const label = labels[pointIndex];
        const isNoise = label === -1;

        if (displayGroupColors && isNoise) return 0;
        return 1 / currentTransform.k;
      })
      .style("cursor", (d) => {
        const pointIndex = points.findIndex(p => p.id === d.id);
        const label = labels[pointIndex];
        return label === -1 ? "default" : "pointer";
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        const pointIndex = points.findIndex(p => p.id === d.id);
        handlePointClick(d.id, pointIndex);
      });

    // Draw selected points on top (top layer)
    container.selectAll(".selected-point")
      .data(selectedPointsArray)
      .enter()
      .append("circle")
      .attr("class", "selected-point")
      .attr("r", 4 / currentTransform.k)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("fill", (d) => {
        const pointIndex = points.findIndex(p => p.id === d.id);
        const label = labels[pointIndex];

        if (displayGroupColors) {
          if (label === -1) {
            return "#cccccc"; // Gray for noise
          }
          return color(label.toString());
        } else {
          return "#ff8c00"; // Orange for selected
        }
      })
      .attr("opacity", 1.0)
      .attr("stroke", "black")
      .attr("stroke-width", 2 / currentTransform.k)
      .style("cursor", (d) => {
        const pointIndex = points.findIndex(p => p.id === d.id);
        const label = labels[pointIndex];
        return label === -1 ? "default" : "pointer";
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        const pointIndex = points.findIndex(p => p.id === d.id);
        handlePointClick(d.id, pointIndex);
      });

    // Draw hulls above points if configured
    if (hullConfig.renderOrder === 'above') {
      drawHulls();
    }

    console.log('🎨 Drew', container.selectAll("circle").size(), 'circles');

  }, [points, xScale, yScale, labelsByThreshold, currentLambda, nearestThreshold, selectedPoints, displayGroupColors, handlePointClick, hullConfig, generateConcaveHull, color]);

  // Add zoom behavior
  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .filter((event) => {
        // Allow wheel events for zooming
        if (event.type === "wheel") return true;
        // Allow touch events for multi-touch zoom and pan on mobile
        if (event.type === "touchstart" || event.type === "touchmove" || event.type === "touchend") {
          return true;
        }
        // Allow mouse events for panning (but not clicking on points)
        if (event.type === "mousedown") {
          const target = event.target as Element;
          return !target.closest("circle");
        }
        return false;
      })
      .on("zoom", (event) => {
        const transform = event.transform;
        container.attr("transform", transform);

        // Update circle sizes and stroke widths for both selected and unselected
        container.selectAll(".unselected-point")
          .attr("r", 4 / transform.k)
          .attr("stroke-width", function(d: any) {
            const pointIndex = points.findIndex(p => p.id === d.id);
            const threshold = nearestThreshold(currentLambda);
            const labels = labelsByThreshold[threshold];
            if (!labels) return 1 / transform.k;

            const label = labels[pointIndex];
            const isNoise = label === -1;

            if (displayGroupColors && isNoise) return 0;
            return 1 / transform.k;
          });

        container.selectAll(".selected-point")
          .attr("r", 4 / transform.k)
          .attr("stroke-width", 2 / transform.k);

        // Update hull stroke widths
        container.selectAll("path")
          .attr("stroke-width", hullConfig.strokeWidth / transform.k);
      });

    svg.call(zoom);

    // Background click handler
    svg.on("click", function(event) {
      if (event.target === this || event.target === container.node()) {
        handleBackgroundClick();
      }
    });

    return () => {
      svg.on(".zoom", null);
      svg.on("click", null);
    };
  }, [points, currentLambda, nearestThreshold, labelsByThreshold, selectedPoints, displayGroupColors, handleBackgroundClick]);

  // Calculate cluster proportions at current water level
  const clusterProportions = React.useMemo(() => {
    if (!points.length || !Object.keys(labelsByThreshold).length) {
      return { clustered: 0, unclustered: 0, clusteredCount: 0, unclusteredCount: 0, clusterGroups: [], selectedClusterId: null };
    }

    const threshold = nearestThreshold(currentLambda);
    const labels = labelsByThreshold[threshold];
    if (!labels) {
      return { clustered: 0, unclustered: 0, clusteredCount: 0, unclusteredCount: 0, clusterGroups: [], selectedClusterId: null };
    }

    const clusteredCount = labels.filter(label => label !== -1).length;
    const unclusteredCount = labels.filter(label => label === -1).length;
    const total = clusteredCount + unclusteredCount;

    // Determine which cluster is selected (if any)
    let selectedClusterId: number | null = null;
    if (selectedPoints.size > 0) {
      // Get the cluster ID of the first selected point
      const firstSelectedPoint = Array.from(selectedPoints)[0];
      const pointIndex = points.findIndex(p => p.id === firstSelectedPoint);
      if (pointIndex !== -1) {
        const clusterId = labels[pointIndex];
        if (clusterId !== -1) {
          selectedClusterId = clusterId;
        }
      }
    }

    // Calculate cluster groups for segmented view
    const clusterGroups: Array<{ clusterId: number; count: number; percentage: number }> = [];
    if (SEGMENT_CLUSTERED) {
      const clusterCounts = new Map<number, number>();
      labels.forEach(label => {
        if (label !== -1) {
          clusterCounts.set(label, (clusterCounts.get(label) || 0) + 1);
        }
      });

      // Convert to array and sort by cluster ID to maintain consistent order
      Array.from(clusterCounts.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([clusterId, count]) => {
          clusterGroups.push({
            clusterId,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0
          });
        });
    }

    return {
      clustered: total > 0 ? (clusteredCount / total) * 100 : 0,
      unclustered: total > 0 ? (unclusteredCount / total) * 100 : 0,
      clusteredCount,
      unclusteredCount,
      clusterGroups,
      selectedClusterId
    };
  }, [points.length, labelsByThreshold, currentLambda, nearestThreshold, selectedPoints, points]);

  if (isLoading) {
    return <LoadingDisplay message="Loading HDBSCAN data..." />;
  }

  const selectedCount = selectedPoints.size;
  const totalPoints = points.length;

  return (
    <div className="relative w-screen h-screen">
      <svg
        ref={svgRef}
        className="w-screen h-screen block bg-gray-50"
        style={{ touchAction: 'none' }}
      />

      <div className="absolute top-4 left-4 flex flex-col gap-4 z-10">
        <ClusterSelectionPanel
          title="HDBSCAN Concave Hull Explorer"
          currentLambda={currentLambda}
          onLambdaChange={setCurrentLambda}
          selectedCount={selectedCount}
          totalPoints={totalPoints}
          clusterProportions={clusterProportions}
          autoSelectMode={autoSelectMode}
          onAutoSelectModeChange={(checked) => {
            setAutoSelectMode(checked);
            setLastSelectedPoint(null);
          }}
          expandSelectionMode={expandSelectionMode}
          onExpandSelectionModeChange={setExpandSelectionMode}
          displayGroupColors={displayGroupColors}
          onDisplayGroupColorsChange={setDisplayGroupColors}
          segmentClustered={SEGMENT_CLUSTERED}
        />

        <ConcaveHullPanel
          config={hullConfig}
          onConfigChange={setHullConfig}
        />
      </div>
    </div>
  );
};