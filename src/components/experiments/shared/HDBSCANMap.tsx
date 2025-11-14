"use client";

import * as React from "react";
import * as d3 from "d3";
import type { Point, LabelsByThreshold, MapVisualizationProps, MapRenderContext } from './types';

export const HDBSCANMap: React.FC<MapVisualizationProps> = ({
  points,
  labelsByThreshold,
  currentLambda,
  selectedPoints,
  displayGroupColors,
  callbacks,
  onRenderBelowPoints,
  onRenderAbovePoints
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  const color = d3.scaleOrdinal(d3.schemeTableau10);

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

    // Render elements below points
    if (onRenderBelowPoints) {
      const context: MapRenderContext = {
        container,
        xScale,
        yScale,
        points,
        labels,
        selectedPoints,
        currentTransform,
        color
      };
      onRenderBelowPoints(context);
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
        callbacks.onPointClick(d.id, pointIndex);
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
        callbacks.onPointClick(d.id, pointIndex);
      });

    // Render elements above points
    if (onRenderAbovePoints) {
      const context: MapRenderContext = {
        container,
        xScale,
        yScale,
        points,
        labels,
        selectedPoints,
        currentTransform,
        color
      };
      onRenderAbovePoints(context);
    }

    console.log('🎨 Drew', container.selectAll("circle").size(), 'circles');

  }, [points, xScale, yScale, labelsByThreshold, currentLambda, nearestThreshold, selectedPoints, displayGroupColors, callbacks, onRenderBelowPoints, onRenderAbovePoints, color]);

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

        // Update any additional elements (like hull stroke widths)
        container.selectAll("path")
          .attr("stroke-width", function() {
            const currentStrokeWidth = d3.select(this).attr("data-base-stroke-width") || "2";
            return parseFloat(currentStrokeWidth) / transform.k;
          });
      });

    svg.call(zoom);

    // Background click handler
    svg.on("click", function(event) {
      if (event.target === this || event.target === container.node()) {
        callbacks.onBackgroundClick();
      }
    });

    return () => {
      svg.on(".zoom", null);
      svg.on("click", null);
    };
  }, [points, currentLambda, nearestThreshold, labelsByThreshold, selectedPoints, displayGroupColors, callbacks]);

  return (
    <svg
      ref={svgRef}
      className="w-screen h-screen block bg-gray-50"
      style={{ touchAction: 'none' }}
    />
  );
};