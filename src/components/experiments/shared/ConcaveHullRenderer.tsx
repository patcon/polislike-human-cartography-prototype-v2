"use client";

import * as React from "react";
import * as d3 from "d3";
import concaveman from "concaveman";
import type { Point } from './types';
import type { ConcaveHullConfig } from './ConcaveHullConfigModal';

interface ConcaveHullRendererProps {
  container?: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale?: d3.ScaleLinear<number, number>;
  yScale?: d3.ScaleLinear<number, number>;
  points?: Point[];
  labels?: number[];
  selectedPoints?: Set<string>;
  currentTransform?: d3.ZoomTransform;
  color?: d3.ScaleOrdinal<string, string>;
  renderOrder?: 'above' | 'below';
  hullConfig: ConcaveHullConfig;
}

export const ConcaveHullRenderer: React.FC<ConcaveHullRendererProps> = ({
  container,
  xScale,
  yScale,
  points,
  labels,
  selectedPoints,
  currentTransform,
  color,
  renderOrder,
  hullConfig
}) => {
  // Generate concave hull for a cluster using concaveman
  const generateConcaveHull = React.useCallback((clusterPoints: Point[]): string => {
    if (clusterPoints.length < 3 || !xScale || !yScale) return "";

    try {
      // Convert points to screen coordinates
      const screenPoints: [number, number][] = clusterPoints.map(p => [xScale(p.x), yScale(p.y)]);

      // Use concaveman to generate concave hull
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
      const fallbackScreenPoints: [number, number][] = clusterPoints.map(p => [xScale(p.x), yScale(p.y)]);
      const fallbackHullPoints = d3.polygonHull(fallbackScreenPoints);
      if (!fallbackHullPoints || fallbackHullPoints.length < 3) return "";
      return `M${fallbackHullPoints.map(p => p.join(",")).join("L")}Z`;
    }
  }, [xScale, yScale, hullConfig.concavity, hullConfig.lengthThreshold]);

  // Render hulls when all required props are available
  React.useEffect(() => {
    if (!hullConfig.enabled || !container || !points || !labels || !selectedPoints || !currentTransform || !color) {
      return;
    }

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
            .attr("stroke-opacity", hullConfig.strokeOpacity)
            .attr("data-base-stroke-width", hullConfig.strokeWidth.toString());
        }
      }
    });
  }, [container, points, labels, selectedPoints, currentTransform, color, hullConfig, generateConcaveHull]);

  // This component doesn't render anything directly - it manipulates the D3 container
  return null;
};