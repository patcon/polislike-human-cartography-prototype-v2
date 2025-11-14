"use client";

import * as React from "react";
import { ClusterSelectionPanel } from './shared/ClusterSelectionPanel';
import { LoadingDisplay } from './shared/LoadingDisplay';
import { ConcaveHullPanel } from './shared/ConcaveHullPanel';
import { HDBSCANMap } from './shared/HDBSCANMap';
import { renderConcaveHulls } from './shared/concaveHullUtils';
import { useHDBSCANData, useClusterSelection, useClusterProportions } from './shared/hooks';
import type { MapCallbacks, MapRenderContext } from './shared/types';
import type { ConcaveHullConfig } from './shared/ConcaveHullConfigModal';

// Configuration constant for segmented cluster view
const SEGMENT_CLUSTERED = true;

type DisplaySettings = {
  // Remove width/height props since we'll use full screen
};

export const ConcaveHullExperiment: React.FC<DisplaySettings> = () => {
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

  // Hull configuration state (specific to this experiment)
  const [hullConfig, setHullConfig] = React.useState<ConcaveHullConfig>({
    enabled: true,
    concavity: 2.0,
    lengthThreshold: 0,
    fillOpacity: 1.0,
    strokeOpacity: 0.6,
    strokeWidth: 2,
    showOnlySelected: false,
    excludeNoise: true,
    renderOrder: 'above'
  });

  // Handle loading error
  if (error) {
    return <LoadingDisplay message={`Error loading data: ${error}`} />;
  }

  // Create map callbacks
  const mapCallbacks: MapCallbacks = React.useMemo(() => ({
    onPointClick: handlePointClick,
    onBackgroundClick: handleBackgroundClick
  }), [handlePointClick, handleBackgroundClick]);

  // Hull rendering functions
  const renderHullsBelow = React.useCallback((context: MapRenderContext) => {
    if (hullConfig.renderOrder === 'below') {
      renderConcaveHulls(context, hullConfig);
    }
  }, [hullConfig]);

  const renderHullsAbove = React.useCallback((context: MapRenderContext) => {
    if (hullConfig.renderOrder === 'above') {
      renderConcaveHulls(context, hullConfig);
    }
  }, [hullConfig]);

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
        onRenderBelowPoints={renderHullsBelow}
        onRenderAbovePoints={renderHullsAbove}
      />

      <div className="absolute top-4 left-4 flex flex-col gap-4 z-10">
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

        <ConcaveHullPanel
          config={hullConfig}
          onConfigChange={setHullConfig}
          points={points}
          labels={labelsByThreshold[nearestThreshold(currentLambda)]}
          selectedPoints={selectedPoints}
        />
      </div>
    </div>
  );
};