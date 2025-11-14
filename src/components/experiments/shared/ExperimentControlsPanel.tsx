import React from 'react';
import { Label } from "@/components/ui/label";
import { ClusterProportionsBar } from './ClusterProportionsBar';

interface ClusterGroup {
  clusterId: number;
  count: number;
  percentage: number;
}

interface ClusterProportions {
  clustered: number;
  unclustered: number;
  clusteredCount: number;
  unclusteredCount: number;
  clusterGroups: ClusterGroup[];
  selectedClusterId: number | null;
}

interface ExperimentControlsPanelProps {
  title: string;
  currentLambda: number;
  onLambdaChange: (value: number) => void;
  selectedCount: number;
  totalPoints: number;
  clusterProportions: ClusterProportions;
  autoSelectMode: boolean;
  onAutoSelectModeChange: (checked: boolean) => void;
  expandSelectionMode: boolean;
  onExpandSelectionModeChange: (checked: boolean) => void;
  displayGroupColors: boolean;
  onDisplayGroupColorsChange: (checked: boolean) => void;
  segmentClustered?: boolean;
  additionalControls?: React.ReactNode;
}

export const ExperimentControlsPanel: React.FC<ExperimentControlsPanelProps> = ({
  title,
  currentLambda,
  onLambdaChange,
  selectedCount,
  totalPoints,
  clusterProportions,
  autoSelectMode,
  onAutoSelectModeChange,
  expandSelectionMode,
  onExpandSelectionModeChange,
  displayGroupColors,
  onDisplayGroupColorsChange,
  segmentClustered = true,
  additionalControls
}) => {
  const percentage = totalPoints > 0 ? Math.round((selectedCount / totalPoints) * 100) : 0;

  return (
    <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg border max-w-xs z-10">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>

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
            onChange={(e) => onLambdaChange(parseFloat(e.target.value))}
            className="w-full"
            disabled={autoSelectMode}
          />

          {/* Selected points count */}
          <div className="text-sm font-medium text-gray-700 mt-2">
            Selected points: {selectedCount} / {totalPoints} ({percentage}%)
          </div>

          {/* Group count - only show when segmented clustering is enabled */}
          {segmentClustered && (
            <div className="text-sm font-medium text-gray-700">
              Group count: {clusterProportions.clusterGroups.length}
            </div>
          )}

          <ClusterProportionsBar
            clusteredCount={clusterProportions.clusteredCount}
            unclusteredCount={clusterProportions.unclusteredCount}
            clustered={clusterProportions.clustered}
            unclustered={clusterProportions.unclustered}
            clusterGroups={clusterProportions.clusterGroups}
            selectedClusterId={clusterProportions.selectedClusterId}
            segmentClustered={segmentClustered}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoSelectMode}
              onChange={(e) => onAutoSelectModeChange(e.target.checked)}
            />
            <span className="text-sm">Auto-select threshold (click finds optimal λ level)</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={expandSelectionMode}
              onChange={(e) => onExpandSelectionModeChange(e.target.checked)}
              disabled={!autoSelectMode}
            />
            <span className="text-sm">Expand selection (click any selected point to drill deeper)</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={displayGroupColors}
              onChange={(e) => onDisplayGroupColorsChange(e.target.checked)}
            />
            <span className="text-sm">Style by cluster label (debug)</span>
          </label>
        </div>

        {/* Additional controls can be inserted here */}
        {additionalControls}
      </div>
    </div>
  );
};