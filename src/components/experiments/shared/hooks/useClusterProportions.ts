import * as React from "react";
import type { Point, LabelsByThreshold, ClusterProportions } from '../types';

export const useClusterProportions = (
  points: Point[],
  labelsByThreshold: LabelsByThreshold,
  currentLambda: number,
  selectedPoints: Set<string>,
  nearestThreshold: (val: number) => string,
  segmentClustered: boolean = true
): ClusterProportions => {
  return React.useMemo(() => {
    if (!points.length || !Object.keys(labelsByThreshold).length) {
      return { 
        clustered: 0, 
        unclustered: 0, 
        clusteredCount: 0, 
        unclusteredCount: 0, 
        clusterGroups: [], 
        selectedClusterId: null 
      };
    }

    const threshold = nearestThreshold(currentLambda);
    const labels = labelsByThreshold[threshold];
    if (!labels) {
      return { 
        clustered: 0, 
        unclustered: 0, 
        clusteredCount: 0, 
        unclusteredCount: 0, 
        clusterGroups: [], 
        selectedClusterId: null 
      };
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
    if (segmentClustered) {
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
  }, [points.length, labelsByThreshold, currentLambda, nearestThreshold, selectedPoints, points, segmentClustered]);
};