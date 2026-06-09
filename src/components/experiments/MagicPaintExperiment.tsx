"use client";

import * as React from "react";
import { ClusterSelectionPanel } from './shared/ClusterSelectionPanel';
import { LoadingDisplay } from './shared/LoadingDisplay';
import { HDBSCANMap } from './shared/HDBSCANMap';
import { useHDBSCANData, useClusterSelection, useClusterProportions } from './shared/hooks';
import type { MapCallbacks } from './shared/types';

// Configuration constant for segmented cluster view
const SEGMENT_CLUSTERED = true;

type DisplaySettings = Record<string, never>;

export const MagicPaintExperiment: React.FC<DisplaySettings> = () => {
  // Use custom hooks for shared functionality
  const { points, labelsByThreshold, isLoading, error } = useHDBSCANData();

  const {
    currentLambda,
    autoSelectMode,
    expandSelectionMode,
    displayGroupColors,
    selectedPoints,
    setCurrentLambda,
    setAutoSelectMode,
    setExpandSelectionMode,
    setDisplayGroupColors,
    setLastSelectedPoint,
    handlePointClick,
    handleBackgroundClick,
    nearestThreshold
  } = useClusterSelection(points, labelsByThreshold);

  const clusterProportions = useClusterProportions(
    points,
    labelsByThreshold,
    currentLambda,
    selectedPoints,
    nearestThreshold,
    SEGMENT_CLUSTERED
  );

  // Handle loading error
  if (error) {
    return <LoadingDisplay message={`Error loading data: ${error}`} />;
  }

  // Create map callbacks
  const mapCallbacks: MapCallbacks = React.useMemo(() => ({
    onPointClick: handlePointClick,
    onBackgroundClick: handleBackgroundClick
  }), [handlePointClick, handleBackgroundClick]);

  if (isLoading) {
    return <LoadingDisplay message="Loading HDBSCAN data..." />;
  }

  const selectedCount = selectedPoints.size;
  const totalPoints = points.length;

  return (
    <div className="relative w-screen h-screen">
      <HDBSCANMap
        points={points}
        labelsByThreshold={labelsByThreshold}
        currentLambda={currentLambda}
        selectedPoints={selectedPoints}
        displayGroupColors={displayGroupColors}
        callbacks={mapCallbacks}
      />

      <div className="absolute top-4 left-4 z-10">
        <ClusterSelectionPanel
          title="HDBSCAN Cluster Explorer"
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
      </div>
    </div>
  );
};