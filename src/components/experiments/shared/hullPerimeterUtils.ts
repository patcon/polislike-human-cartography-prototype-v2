import * as d3 from "d3";
import concaveman from "concaveman";
import type { Point } from './types';
import type { ConcaveHullConfig } from './ConcaveHullConfigModal';

export interface HullPerimeterData {
  clusterId: number;
  perimeter: number;
  color: string;
  hasSelectedPoints: boolean;
}

export const calculateHullPerimeter = (
  points: Point[],
  labels: number[],
  selectedPoints: Set<string>,
  hullConfig: ConcaveHullConfig,
  color: d3.ScaleOrdinal<string, string>
): HullPerimeterData[] => {
  if (!hullConfig.enabled) return [];

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

  const perimeterData: HullPerimeterData[] = [];

  // Calculate perimeter for each cluster
  clusterGroups.forEach((clusterPoints, clusterId) => {
    if (clusterPoints.length >= 3) {
      const perimeter = calculateClusterPerimeter(clusterPoints, hullConfig);
      if (perimeter > 0) {
        // Check if this cluster has any selected points
        const hasSelectedPoints = clusterPoints.some(point => selectedPoints.has(point.id));

        perimeterData.push({
          clusterId,
          perimeter,
          color: color(clusterId.toString()),
          hasSelectedPoints,
        });
      }
    }
  });

  // Sort by cluster ID for consistent ordering
  return perimeterData.sort((a, b) => a.clusterId - b.clusterId);
};

const calculateClusterPerimeter = (clusterPoints: Point[], hullConfig: ConcaveHullConfig): number => {
  if (clusterPoints.length < 3) return 0;

  try {
    // Convert points to coordinate pairs for concaveman
    const coordinates: [number, number][] = clusterPoints.map(p => [p.x, p.y]);

    // Use concaveman to generate concave hull
    const concavity = hullConfig.concavity;
    const lengthThreshold = hullConfig.lengthThreshold;

    let hullPoints = concaveman(coordinates, concavity, lengthThreshold);

    if (!hullPoints || hullPoints.length < 3) {
      // Fallback to convex hull if concaveman fails
      const convexHull = d3.polygonHull(coordinates);
      if (!convexHull || convexHull.length < 3) return 0;
      hullPoints = convexHull;
    }

    // Calculate perimeter by summing distances between consecutive points
    let perimeter = 0;
    for (let i = 0; i < hullPoints.length; i++) {
      const current = hullPoints[i];
      const next = hullPoints[(i + 1) % hullPoints.length]; // Wrap around to first point

      const dx = next[0] - current[0];
      const dy = next[1] - current[1];
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }

    return perimeter;
  } catch (error) {
    console.warn('Failed to calculate hull perimeter:', error);
    return 0;
  }
};