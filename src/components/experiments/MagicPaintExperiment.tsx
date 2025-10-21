"use client";

import * as React from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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

export const MagicPaintExperiment: React.FC<DisplaySettings> = () => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  const [points, setPoints] = React.useState<Point[]>([]);
  const [labelsByThreshold, setLabelsByThreshold] = React.useState<LabelsByThreshold>({});
  const [currentLambda, setCurrentLambda] = React.useState(3.0);
  const [autoSelectMode, setAutoSelectMode] = React.useState(false);
  const [expandSelectionMode, setExpandSelectionMode] = React.useState(false);
  const [displayGroupColors, setDisplayGroupColors] = React.useState(true);
  const [selectedPoints, setSelectedPoints] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastSelectedPoint, setLastSelectedPoint] = React.useState<string | null>(null);

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

    // Draw points
    container.selectAll("circle")
      .data(points)
      .enter()
      .append("circle")
      .attr("class", "point")
      .attr("r", 4 / currentTransform.k)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("fill", (d, i) => {
        const label = labels[i];
        const isSelected = selectedPoints.has(d.id);

        if (displayGroupColors) {
          if (label === -1) {
            return "#cccccc"; // Gray for noise
          }
          return color(label.toString());
        } else {
          return isSelected ? "#ff8c00" : "#d3d3d3"; // Orange for selected, light gray for others
        }
      })
      .attr("opacity", (d, i) => {
        const label = labels[i];
        if (displayGroupColors) {
          return label === -1 ? 0.4 : 1.0; // Make noise points more transparent
        } else {
          return 1.0;
        }
      })
      .attr("stroke", d => selectedPoints.has(d.id) ? "black" : "#333")
      .attr("stroke-width", (d, i) => {
        const label = labels[i];
        const isNoise = label === -1;
        const isSelected = selectedPoints.has(d.id);
        
        if (displayGroupColors && isNoise) return 0;
        return (isSelected ? 2 : 1) / currentTransform.k;
      })
      .style("cursor", (d, i) => {
        const label = labels[i];
        return label === -1 ? "default" : "pointer";
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        const pointIndex = points.findIndex(p => p.id === d.id);
        handlePointClick(d.id, pointIndex);
      });

    console.log('🎨 Drew', container.selectAll("circle").size(), 'circles');

  }, [points, xScale, yScale, labelsByThreshold, currentLambda, nearestThreshold, selectedPoints, displayGroupColors, handlePointClick]);

  // Add zoom behavior
  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "mousedown") {
          const target = event.target as Element;
          return !target.closest("circle");
        }
        return false;
      })
      .on("zoom", (event) => {
        const transform = event.transform;
        container.attr("transform", transform);

        // Update circle sizes and stroke widths
        container.selectAll("circle")
          .attr("r", 4 / transform.k)
          .attr("stroke-width", function(d: any) {
            const pointIndex = points.findIndex(p => p.id === d.id);
            const threshold = nearestThreshold(currentLambda);
            const labels = labelsByThreshold[threshold];
            if (!labels) return 1 / transform.k;
            
            const label = labels[pointIndex];
            const isNoise = label === -1;
            const isSelected = selectedPoints.has(d.id);
            
            if (displayGroupColors && isNoise) return 0;
            return (isSelected ? 2 : 1) / transform.k;
          });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen">
        <div className="text-lg">Loading HDBSCAN data...</div>
      </div>
    );
  }

  const selectedCount = selectedPoints.size;
  const totalPoints = points.length;
  const percentage = totalPoints > 0 ? Math.round((selectedCount / totalPoints) * 100) : 0;

  return (
    <div className="relative w-screen h-screen">
      <svg ref={svgRef} className="w-screen h-screen block bg-gray-50" />
      
      {/* Controls overlay - positioned on canvas */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg border max-w-xs z-10">
        <h3 className="text-lg font-semibold mb-3">HDBSCAN Cluster Explorer</h3>
        
        <div className="space-y-3">
          <div>
            <Label className="block text-sm font-medium mb-1">
              Water Level (λ threshold): {currentLambda.toFixed(1)}
            </Label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={currentLambda}
              onChange={(e) => setCurrentLambda(parseFloat(e.target.value))}
              className="w-full"
              disabled={autoSelectMode}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoSelectMode}
                onChange={(e) => {
                  setAutoSelectMode(e.target.checked);
                  if (!e.target.checked) {
                    setExpandSelectionMode(false);
                  }
                  setLastSelectedPoint(null);
                }}
              />
              <span className="text-sm">Auto-select threshold (click finds optimal λ level)</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={expandSelectionMode}
                onChange={(e) => setExpandSelectionMode(e.target.checked)}
                disabled={!autoSelectMode}
              />
              <span className="text-sm">Expand selection (click any selected point to drill deeper)</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={displayGroupColors}
                onChange={(e) => setDisplayGroupColors(e.target.checked)}
              />
              <span className="text-sm">Style by cluster label</span>
            </label>
          </div>

          <div className="text-sm font-medium text-gray-700">
            Selected points: {selectedCount} / {totalPoints} ({percentage}%)
          </div>
        </div>
      </div>
    </div>
  );
};