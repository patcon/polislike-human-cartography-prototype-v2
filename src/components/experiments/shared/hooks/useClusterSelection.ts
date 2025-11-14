import * as React from "react";
import type { Point, LabelsByThreshold } from '../types';

export interface ClusterSelectionState {
  currentLambda: number;
  autoSelectMode: boolean;
  expandSelectionMode: boolean;
  displayGroupColors: boolean;
  selectedPoints: Set<string>;
  lastSelectedPoint: string | null;
}

export interface ClusterSelectionActions {
  setCurrentLambda: (lambda: number) => void;
  setAutoSelectMode: (mode: boolean) => void;
  setExpandSelectionMode: (mode: boolean) => void;
  setDisplayGroupColors: (display: boolean) => void;
  setSelectedPoints: (points: Set<string>) => void;
  setLastSelectedPoint: (pointId: string | null) => void;
  handlePointClick: (pointId: string, pointIndex: number) => void;
  handleBackgroundClick: () => void;
  nearestThreshold: (val: number) => string;
  selectCluster: (clusterId: number, labels: number[]) => void;
  findOptimalLambda: (pointIndex: number) => number | null;
  findNextDeeperLambda: (pointIndex: number, currentLambda: number) => number | null;
}

export const useClusterSelection = (
  points: Point[],
  labelsByThreshold: LabelsByThreshold
): ClusterSelectionState & ClusterSelectionActions => {
  const [currentLambda, setCurrentLambda] = React.useState(3.0);
  const [autoSelectMode, setAutoSelectMode] = React.useState(true);
  const [expandSelectionMode, setExpandSelectionMode] = React.useState(true);
  const [displayGroupColors, setDisplayGroupColors] = React.useState(false);
  const [selectedPoints, setSelectedPoints] = React.useState<Set<string>>(new Set());
  const [lastSelectedPoint, setLastSelectedPoint] = React.useState<string | null>(null);

  // Find nearest threshold
  const nearestThreshold = React.useCallback((val: number): string => {
    const keys = Object.keys(labelsByThreshold).map(parseFloat);
    const closest = keys.reduce((a, b) => Math.abs(a - val) < Math.abs(b - val) ? a : b);
    return closest.toFixed(2);
  }, [labelsByThreshold]);

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

  return {
    // State
    currentLambda,
    autoSelectMode,
    expandSelectionMode,
    displayGroupColors,
    selectedPoints,
    lastSelectedPoint,
    // Actions
    setCurrentLambda,
    setAutoSelectMode,
    setExpandSelectionMode,
    setDisplayGroupColors,
    setSelectedPoints,
    setLastSelectedPoint,
    handlePointClick,
    handleBackgroundClick,
    nearestThreshold,
    selectCluster,
    findOptimalLambda,
    findNextDeeperLambda
  };
};